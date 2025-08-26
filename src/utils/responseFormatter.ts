import { sanitizeRichContent, escapeHtml as escapeHtmlSanitizer } from './sanitizer';

export interface FormattedResponse {
  html: string;
  text: string;
  hasRichContent: boolean;
  mediaAttachments: Array<{
    type: 'latex' | 'code' | 'diagram' | 'link';
    content: string;
    metadata?: any;
  }>;
}

export class ResponseFormatter {
  private static readonly LATEX_PATTERN = /\$\$(.+?)\$\$|\$(.+?)\$/g;
  private static readonly CODE_BLOCK_PATTERN = /```(\w+)?\n([\s\S]*?)```/g;
  private static readonly INLINE_CODE_PATTERN = /`([^`]+)`/g;
  private static readonly LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  private static readonly HEADING_PATTERN = /^(#{1,6})\s+(.+)$/gm;
  private static readonly BOLD_PATTERN = /\*\*([^*]+)\*\*/g;
  private static readonly ITALIC_PATTERN = /\*([^*]+)\*/g;
  private static readonly LIST_PATTERN = /^(\s*)([-*+]|\d+\.)\s+(.+)$/gm;
  private static readonly BLOCKQUOTE_PATTERN = /^>\s+(.+)$/gm;

  static formatResponse(content: string): FormattedResponse {
    // First, sanitize the content to prevent XSS
    const sanitized = sanitizeRichContent(content);

    // Extract media attachments
    const mediaAttachments = this.extractMediaAttachments(sanitized);

    // Convert markdown to HTML
    const html = this.markdownToHtml(sanitized);

    // Extract plain text
    const text = this.extractPlainText(sanitized);

    // Check if content has rich formatting
    const hasRichContent = this.hasRichFormatting(content);

    return {
      html,
      text,
      hasRichContent,
      mediaAttachments,
    };
  }

  static markdownToHtml(content: string): string {
    let html = content;

    // Process in order to avoid conflicts

    // 1. Code blocks first (to preserve their content)
    const codeBlocks: string[] = [];
    html = html.replace(this.CODE_BLOCK_PATTERN, (_match, lang, code) => {
      const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapeHtmlSanitizer(code.trim())}</code></pre>`);
      return placeholder;
    });

    // 2. LaTeX expressions
    const latexExpressions: string[] = [];
    html = html.replace(this.LATEX_PATTERN, (match, block, inline) => {
      const placeholder = `__LATEX_${latexExpressions.length}__`;
      const latex = block || inline;
      const className = block ? 'latex-block' : 'latex-inline';
      latexExpressions.push(`<span class="${className}" data-latex="${escapeHtmlSanitizer(latex)}">${match}</span>`);
      return placeholder;
    });

    // 3. Inline code
    html = html.replace(this.INLINE_CODE_PATTERN, '<code>$1</code>');

    // 4. Headings
    html = html.replace(this.HEADING_PATTERN, (_match, hashes, text) => {
      const level = hashes.length;
      return `<h${level}>${text}</h${level}>`;
    });

    // 5. Bold and italic
    html = html.replace(this.BOLD_PATTERN, '<strong>$1</strong>');
    html = html.replace(this.ITALIC_PATTERN, '<em>$1</em>');

    // 6. Links
    html = html.replace(this.LINK_PATTERN, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // 7. Lists
    html = this.processLists(html);

    // 8. Blockquotes
    html = html.replace(this.BLOCKQUOTE_PATTERN, '<blockquote>$1</blockquote>');

    // 9. Paragraphs
    html = this.processParagraphs(html);

    // Restore code blocks and LaTeX
    codeBlocks.forEach((block, i) => {
      html = html.replace(`__CODE_BLOCK_${i}__`, block);
    });

    latexExpressions.forEach((expr, i) => {
      html = html.replace(`__LATEX_${i}__`, expr);
    });

    return html;
  }

  static processLists(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let currentIndent = 0;

    for (const line of lines) {
      const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);

      if (listMatch) {
        const [, indent, marker, text] = listMatch;
        const newIndent = indent.length;
        const newListType = /\d+\./.test(marker) ? 'ol' : 'ul';

        if (!inList) {
          result.push(`<${newListType}>`);
          inList = true;
          listType = newListType;
          currentIndent = newIndent;
        } else if (newListType !== listType || newIndent !== currentIndent) {
          result.push(`</${listType}>`);
          result.push(`<${newListType}>`);
          listType = newListType;
          currentIndent = newIndent;
        }

        result.push(`<li>${text}</li>`);
      } else {
        if (inList) {
          result.push(`</${listType}>`);
          inList = false;
          listType = null;
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push(`</${listType}>`);
    }

    return result.join('\n');
  }

  static processParagraphs(content: string): string {
    const lines = content.split('\n');
    const result: string[] = [];
    let inParagraph = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === '') {
        if (inParagraph) {
          result.push('</p>');
          inParagraph = false;
        }
        continue;
      }

      // Skip if already wrapped in HTML tags
      if (/^<[^>]+>/.test(trimmed)) {
        if (inParagraph) {
          result.push('</p>');
          inParagraph = false;
        }
        result.push(line);
      } else {
        if (!inParagraph) {
          result.push('<p>');
          inParagraph = true;
        }
        result.push(line);
      }
    }

    if (inParagraph) {
      result.push('</p>');
    }

    return result.join('\n');
  }

  static extractMediaAttachments(content: string): FormattedResponse['mediaAttachments'] {
    const attachments: FormattedResponse['mediaAttachments'] = [];

    // Extract LaTeX
    let match;
    while ((match = this.LATEX_PATTERN.exec(content)) !== null) {
      const latex = match[1] || match[2];
      if (latex) {
        attachments.push({
          type: 'latex',
          content: latex,
          metadata: { isBlock: !!match[1] },
        });
      }
    }

    // Extract code blocks
    this.CODE_BLOCK_PATTERN.lastIndex = 0;
    while ((match = this.CODE_BLOCK_PATTERN.exec(content)) !== null) {
      attachments.push({
        type: 'code',
        content: match[2].trim(),
        metadata: { language: match[1] || 'plaintext' },
      });
    }

    // Extract links
    this.LINK_PATTERN.lastIndex = 0;
    while ((match = this.LINK_PATTERN.exec(content)) !== null) {
      attachments.push({
        type: 'link',
        content: match[2],
        metadata: { text: match[1] },
      });
    }

    return attachments;
  }

  static extractPlainText(content: string): string {
    return content
      .replace(this.CODE_BLOCK_PATTERN, '$2')
      .replace(this.LATEX_PATTERN, (_match, block, inline) => block || inline)
      .replace(this.INLINE_CODE_PATTERN, '$1')
      .replace(this.LINK_PATTERN, '$1')
      .replace(this.HEADING_PATTERN, '$2')
      .replace(this.BOLD_PATTERN, '$1')
      .replace(this.ITALIC_PATTERN, '$1')
      .replace(this.LIST_PATTERN, '$3')
      .replace(this.BLOCKQUOTE_PATTERN, '$1')
      .replace(/\n{2,}/g, '\n\n')
      .trim();
  }

  static hasRichFormatting(content: string): boolean {
    return !!(
      this.LATEX_PATTERN.test(content) ||
      this.CODE_BLOCK_PATTERN.test(content) ||
      this.INLINE_CODE_PATTERN.test(content) ||
      this.LINK_PATTERN.test(content) ||
      this.HEADING_PATTERN.test(content) ||
      this.BOLD_PATTERN.test(content) ||
      this.ITALIC_PATTERN.test(content) ||
      this.LIST_PATTERN.test(content) ||
      this.BLOCKQUOTE_PATTERN.test(content)
    );
  }

  static validateUserInput(input: string): { isValid: boolean; sanitized: string; issues: string[] } {
    const issues: string[] = [];
    let sanitized = input;

    // Check for potential XSS attempts
    if (/<script|<iframe|javascript:|on\w+\s*=/i.test(input)) {
      issues.push('Potentially dangerous content detected and removed');
      sanitized = sanitizeRichContent(input);
    }

    // Check message length
    if (input.length > 5000) {
      issues.push('Message exceeds maximum length of 5000 characters');
      sanitized = sanitized.substring(0, 5000);
    }

    // Check for excessive special characters that might indicate an attack
    const specialCharRatio = (input.match(/[<>{}()\[\]]/g) || []).length / input.length;
    if (specialCharRatio > 0.3) {
      issues.push('Message contains excessive special characters');
    }

    return {
      isValid: issues.length === 0,
      sanitized,
      issues,
    };
  }
}
