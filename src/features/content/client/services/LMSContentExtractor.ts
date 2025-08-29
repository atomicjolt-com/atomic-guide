import { EventEmitter } from 'events';

export type LMSPageType = 'assignment' | 'discussion' | 'module' | 'page' | 'quiz' | 'unknown';

export interface LMSContentMetadata {
  headings: Array<{ level: number; text: string; id?: string }>;
  links: Array<{ url: string; text: string; target?: string }>;
  images: Array<{ src: string; alt: string; title?: string }>;
  lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }>;
  emphasis: Array<{ type: 'bold' | 'italic' | 'underline'; text: string }>;
  tables: Array<{ headers: string[]; rows: string[][] }>;
}

export interface LMSContentExtraction {
  pageUrl: string;
  pageType: LMSPageType;
  content: {
    html: string;
    text: string;
    title: string;
    metadata: LMSContentMetadata;
  };
  timestamp: string;
  contentHash: string;
  lmsType?: 'canvas' | 'moodle' | 'blackboard' | 'd2l' | 'unknown';
}

export interface ContentExtractionOptions {
  enableMonitoring?: boolean;
  monitoringInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  validateOrigin?: boolean;
  allowedOrigins?: string[];
}

interface PostMessageRequest {
  subject: string;
  message_id: string;
  data?: any;
}

interface PostMessageResponse {
  subject: string;
  message_id: string;
  data?: any;
  error?: string;
}

export class LMSContentExtractor extends EventEmitter {
  private options: Required<ContentExtractionOptions>;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (response: PostMessageResponse) => void> = new Map();
  private lastContent: LMSContentExtraction | null = null;
  private isListening = false;
  private retryCount = 0;
  private nonces: Map<string, number> = new Map();

  constructor(options: ContentExtractionOptions = {}) {
    super();
    this.options = {
      enableMonitoring: options.enableMonitoring ?? false,
      monitoringInterval: options.monitoringInterval ?? 30000,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      timeout: options.timeout ?? 5000,
      validateOrigin: options.validateOrigin ?? true,
      allowedOrigins: options.allowedOrigins ?? [
        '.instructure.com',
        '.canvaslms.com',
        '.moodle.com',
        '.moodlecloud.com',
        '.blackboard.com',
        '.brightspace.com',
      ],
    };

    this.setupMessageListener();
  }

  private setupMessageListener(): void {
    if (this.isListening) return;

    window.addEventListener('message', this.handleMessage.bind(this));
    this.isListening = true;
  }

  private handleMessage(event: MessageEvent): void {
    if (this.options.validateOrigin && !this.isValidOrigin(event.origin)) {
      console.warn(`Rejected message from untrusted origin: ${event.origin}`);
      return;
    }

    if (!event.data?.subject) return;

    const response = event.data as PostMessageResponse;
    const handler = this.messageHandlers.get(response.message_id);

    if (handler) {
      handler(response);
      this.messageHandlers.delete(response.message_id);
      this.nonces.delete(response.message_id);
    }
  }

  private isValidOrigin(origin: string): boolean {
    try {
      const url = new URL(origin);
      return this.options.allowedOrigins.some((allowed) => {
        if (allowed.startsWith('.')) {
          // Properly validate domain suffix to prevent bypass attacks
          // e.g., .instructure.com should match canvas.instructure.com but not evil.instructure.com.attacker.com
          const suffix = allowed.slice(1); // Remove leading dot
          return url.hostname === suffix || (url.hostname.endsWith('.' + suffix) && !url.hostname.includes(suffix + '.'));
        }
        return url.hostname === allowed;
      });
    } catch {
      return false;
    }
  }

  private generateMessageId(): string {
    const timestamp = Date.now();
    const random = crypto.getRandomValues(new Uint8Array(16));
    const randomHex = Array.from(random)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const id = `lms_content_${timestamp}_${randomHex}`;
    const nonce = timestamp;
    this.nonces.set(id, nonce);
    return id;
  }

  private async generateMessageSignature(message: any): Promise<string> {
    // Generate HMAC signature for message authentication
    const messageString = JSON.stringify(message);
    const encoder = new TextEncoder();
    const data = encoder.encode(messageString);

    // Use a shared secret from session storage (set during LTI launch)
    const secret = sessionStorage.getItem('lti_shared_secret');
    if (!secret) {
      throw new Error('LTI shared secret not found. Cannot authenticate message.');
    }
    const keyData = encoder.encode(secret);

    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

    const signature = await crypto.subtle.sign('HMAC', key, data);
    const signatureArray = Array.from(new Uint8Array(signature));
    return signatureArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async verifyMessageSignature(message: any, signature: string): Promise<boolean> {
    const expectedSignature = await this.generateMessageSignature(message);
    return signature === expectedSignature;
  }

  private async sendPostMessage(subject: string, data?: any): Promise<any> {
    return new Promise(async (resolve, reject) => {
      const messageId = this.generateMessageId();
      const timeoutId = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        this.nonces.delete(messageId);
        reject(new Error(`PostMessage timeout for subject: ${subject}`));
      }, this.options.timeout);

      this.messageHandlers.set(messageId, (response) => {
        clearTimeout(timeoutId);

        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.data);
        }
      });

      const request: PostMessageRequest = {
        subject,
        message_id: messageId,
        data,
      };

      // Add HMAC signature for message authentication
      const signature = await this.generateMessageSignature(request);
      const signedRequest = {
        ...request,
        signature,
        timestamp: Date.now(),
      };

      // Send to parent with specific origin validation
      const targetOrigin = this.getTargetOrigin();
      window.parent.postMessage(signedRequest, targetOrigin);
    });
  }

  private getTargetOrigin(): string {
    // Enforce explicit origin configuration - no fallbacks allowed

    // First, check if we have a stored LMS origin from initial LTI launch
    const storedOrigin = sessionStorage.getItem('lms_origin');
    if (storedOrigin && this.isValidOrigin(storedOrigin)) {
      return storedOrigin;
    }

    // Try to get parent origin from document referrer if it's validated
    if (document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        if (this.isValidOrigin(referrerUrl.origin)) {
          return referrerUrl.origin;
        }
      } catch (error) {
        console.error('Invalid referrer URL:', error);
      }
    }

    // No valid origin found - fail securely rather than using wildcards or insecure fallbacks
    throw new Error('Unable to determine secure target origin for postMessage. Please configure LMS origin.');
  }

  private detectLMSType(): 'canvas' | 'moodle' | 'blackboard' | 'd2l' | 'unknown' {
    const hostname = window.location.hostname;

    if (hostname.includes('instructure.com') || hostname.includes('canvas')) {
      return 'canvas';
    } else if (hostname.includes('moodle') || hostname.includes('moodlecloud')) {
      return 'moodle';
    } else if (hostname.includes('blackboard') || hostname.includes('bb')) {
      return 'blackboard';
    } else if (hostname.includes('brightspace') || hostname.includes('d2l')) {
      return 'd2l';
    }

    return 'unknown';
  }

  private detectPageType(url: string, lmsType: string): LMSPageType {
    const urlPath = url.toLowerCase();

    if (lmsType === 'canvas') {
      if (urlPath.includes('/assignments/')) return 'assignment';
      if (urlPath.includes('/discussion_topics/')) return 'discussion';
      if (urlPath.includes('/modules/')) return 'module';
      if (urlPath.includes('/pages/')) return 'page';
      if (urlPath.includes('/quizzes/')) return 'quiz';
    } else if (lmsType === 'moodle') {
      if (urlPath.includes('/mod/assign/')) return 'assignment';
      if (urlPath.includes('/mod/forum/')) return 'discussion';
      if (urlPath.includes('/course/view.php')) return 'module';
      if (urlPath.includes('/mod/page/')) return 'page';
      if (urlPath.includes('/mod/quiz/')) return 'quiz';
    } else if (lmsType === 'blackboard') {
      if (urlPath.includes('/webapps/assignment/')) return 'assignment';
      if (urlPath.includes('/webapps/discussionboard/')) return 'discussion';
      if (urlPath.includes('/webapps/blackboard/content/')) return 'module';
      if (urlPath.includes('/webapps/blackboard/execute/content/')) return 'page';
      if (urlPath.includes('/webapps/assessment/')) return 'quiz';
    } else if (lmsType === 'd2l') {
      if (urlPath.includes('/dropbox/')) return 'assignment';
      if (urlPath.includes('/discussions/')) return 'discussion';
      if (urlPath.includes('/content/')) return 'module';
      if (urlPath.includes('/le/content/')) return 'page';
      if (urlPath.includes('/quizzing/')) return 'quiz';
    }

    return 'unknown';
  }

  private async extractContentWithRetry(): Promise<any> {
    for (let i = 0; i <= this.options.maxRetries; i++) {
      try {
        const content = await this.sendPostMessage('lti.getPageContent');
        this.retryCount = 0;
        return content;
      } catch (error) {
        this.retryCount = i + 1;

        if (i === this.options.maxRetries) {
          throw error;
        }

        await this.delay(this.options.retryDelay * Math.pow(2, i));
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private sanitizeHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;

    const scripts = div.querySelectorAll('script');
    scripts.forEach((script) => script.remove());

    const styles = div.querySelectorAll('style');
    styles.forEach((style) => style.remove());

    const iframes = div.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const placeholder = document.createElement('div');
      placeholder.textContent = `[Embedded content: ${iframe.src || 'iframe'}]`;
      iframe.replaceWith(placeholder);
    });

    return div.innerHTML;
  }

  private extractMetadata(html: string): LMSContentMetadata {
    const div = document.createElement('div');
    div.innerHTML = html;

    const headings = Array.from(div.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => ({
      level: parseInt(h.tagName[1]),
      text: h.textContent?.trim() || '',
      id: h.id || undefined,
    }));

    const links = Array.from(div.querySelectorAll('a')).map((a) => ({
      url: a.href || '',
      text: a.textContent?.trim() || '',
      target: a.target || undefined,
    }));

    const images = Array.from(div.querySelectorAll('img')).map((img) => ({
      src: img.src || '',
      alt: img.alt || '',
      title: img.title || undefined,
    }));

    const lists = Array.from(div.querySelectorAll('ul, ol')).map((list) => ({
      type: list.tagName.toLowerCase() === 'ul' ? 'unordered' : ('ordered' as 'unordered' | 'ordered'),
      items: Array.from(list.querySelectorAll('li')).map((li) => li.textContent?.trim() || ''),
    }));

    const emphasis = [
      ...Array.from(div.querySelectorAll('strong, b')).map((el) => ({
        type: 'bold' as const,
        text: el.textContent?.trim() || '',
      })),
      ...Array.from(div.querySelectorAll('em, i')).map((el) => ({
        type: 'italic' as const,
        text: el.textContent?.trim() || '',
      })),
      ...Array.from(div.querySelectorAll('u')).map((el) => ({
        type: 'underline' as const,
        text: el.textContent?.trim() || '',
      })),
    ];

    const tables = Array.from(div.querySelectorAll('table')).map((table) => {
      const headers = Array.from(table.querySelectorAll('th')).map((th) => th.textContent?.trim() || '');
      const rows = Array.from(table.querySelectorAll('tbody tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim() || '')
      );
      return { headers, rows };
    });

    return { headings, links, images, lists, emphasis, tables };
  }

  private async hashContent(content: string): Promise<string> {
    // Use Web Crypto API for secure SHA-256 hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  async extractPageContent(): Promise<LMSContentExtraction> {
    try {
      const rawContent = await this.extractContentWithRetry();

      const lmsType = this.detectLMSType();
      const pageUrl = rawContent.url || window.location.href;
      const pageType = this.detectPageType(pageUrl, lmsType);

      const sanitizedHtml = this.sanitizeHtml(rawContent.content || rawContent.html || '');
      const metadata = this.extractMetadata(sanitizedHtml);

      const div = document.createElement('div');
      div.innerHTML = sanitizedHtml;
      const textContent = div.textContent || div.innerText || '';

      const contentHash = await this.hashContent(sanitizedHtml);

      const extraction: LMSContentExtraction = {
        pageUrl,
        pageType,
        content: {
          html: sanitizedHtml,
          text: textContent.trim(),
          title: rawContent.title || document.title || 'Untitled',
          metadata,
        },
        timestamp: new Date().toISOString(),
        contentHash,
        lmsType,
      };

      this.lastContent = extraction;
      this.emit('content-extracted', extraction);

      return extraction;
    } catch (error) {
      console.error('Failed to extract LMS content:', error);
      this.emit('extraction-error', error);
      throw error;
    }
  }

  startContentMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    this.options.enableMonitoring = true;

    const monitor = async () => {
      try {
        const newContent = await this.extractPageContent();

        if (this.lastContent && this.lastContent.contentHash !== newContent.contentHash) {
          this.emit('content-changed', {
            previous: this.lastContent,
            current: newContent,
          });
        }
      } catch (error) {
        console.error('Content monitoring error:', error);
      }
    };

    monitor();
    this.monitoringInterval = setInterval(monitor, this.options.monitoringInterval);
    this.emit('monitoring-started');
  }

  stopContentMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.options.enableMonitoring = false;
      this.emit('monitoring-stopped');
    }
  }

  onContentChange(callback: (change: { previous: LMSContentExtraction; current: LMSContentExtraction }) => void): void {
    this.on('content-changed', callback);
  }

  getLastExtractedContent(): LMSContentExtraction | null {
    return this.lastContent;
  }

  destroy(): void {
    this.stopContentMonitoring();

    if (this.isListening) {
      window.removeEventListener('message', this.handleMessage.bind(this));
      this.isListening = false;
    }

    this.messageHandlers.clear();
    this.nonces.clear();
    this.removeAllListeners();
  }
}

export default LMSContentExtractor;
