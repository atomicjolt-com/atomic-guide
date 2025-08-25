export interface PromptContext {
  courseName?: string;
  moduleName?: string;
  assignmentTitle?: string;
  pageContent?: string;
  learnerProfile?: {
    learningStyle?: string;
    secondaryStyle?: string;
    struggleAreas?: string[];
    preferredLanguage?: string;
    learningVelocity?: number;
    topics?: string[];
    mediaPreferences?: {
      prefers_visual: boolean;
      math_notation_style: 'latex' | 'ascii' | 'spoken';
      code_highlight_theme: 'light' | 'dark';
      diagram_complexity: 'simple' | 'detailed';
      bandwidth_preference: 'high' | 'medium' | 'low';
    };
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  currentQuestion: string;
  conversationSummary?: string;
  contentType?: 'math' | 'code' | 'general' | 'problem-solving';
  requestedMediaTypes?: Array<'latex' | 'code' | 'diagram' | 'video'>;
}

export interface PromptTemplate {
  id: string;
  name: string;
  systemPrompt: string;
  userPromptTemplate: string;
  maxContextLength: number;
}

export class PromptBuilder {
  private static templates: Map<string, PromptTemplate> = new Map([
    ['default', {
      id: 'default',
      name: 'Default Learning Assistant',
      systemPrompt: `You are an AI learning assistant helping students understand course material. 
You provide clear, encouraging, and accurate responses. 
Always be supportive and adapt your explanations to the student's level.

RICH MEDIA FORMATTING GUIDELINES:
- Use LaTeX for mathematical equations: wrap inline math with $ and block math with $$
- For code examples, use \`\`\`language syntax
- Include diagrams and visual explanations when helpful
- Structure responses with clear sections and formatting
- Use appropriate media types based on the question content

FORMAT EXAMPLES:
- Inline math: The slope is $m = \\frac{y_2 - y_1}{x_2 - x_1}$
- Block math: $$\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$$
- Code blocks: \`\`\`python
def example():
    return "Hello World"
\`\`\``,
      userPromptTemplate: `{contextSection}{conversationSection}

Current question: {currentQuestion}`,
      maxContextLength: 2000
    }],
    ['visual-learner', {
      id: 'visual-learner',
      name: 'Visual Learning Assistant',
      systemPrompt: `You are an AI learning assistant specialized in helping visual learners.
ALWAYS include visual representations in your responses:
- Use diagrams and flowcharts (describe them clearly)
- Create ASCII art diagrams when possible
- Use emoji and symbols to illustrate concepts
- Organize information spatially with tables and lists
- Highlight key information with formatting
- Use color descriptions and visual metaphors
Format your responses using markdown and LaTeX notation.`,
      userPromptTemplate: `{contextSection}

Learning Style: Visual (prefers diagrams, charts, and spatial organization)
{conversationSummarySection}
{conversationSection}

Current question: {currentQuestion}

Please provide a response that includes visual elements like diagrams, charts, or spatial layouts to help explain the concept.`,
      maxContextLength: 2500
    }],
    ['auditory-learner', {
      id: 'auditory-learner',
      name: 'Auditory Learning Assistant',
      systemPrompt: `You are an AI learning assistant specialized in helping auditory learners.
Structure your responses as if you're explaining verbally:
- Use conversational tone and rhythm
- Include mnemonics and rhymes when helpful
- Break down explanations into verbal steps
- Use analogies and stories to explain concepts
- Repeat key points in different ways
- Suggest "thinking out loud" exercises
Format responses conversationally with clear verbal flow.`,
      userPromptTemplate: `{contextSection}

Learning Style: Auditory (prefers verbal explanations and discussions)
{conversationSummarySection}
{conversationSection}

Current question: {currentQuestion}

Explain this as if you're having a conversation, using verbal descriptions and analogies.`,
      maxContextLength: 2500
    }],
    ['kinesthetic-learner', {
      id: 'kinesthetic-learner',
      name: 'Kinesthetic Learning Assistant',
      systemPrompt: `You are an AI learning assistant specialized in helping kinesthetic learners.
Focus on hands-on learning and practical application:
- Provide step-by-step practice exercises
- Include real-world examples and applications
- Suggest physical activities or manipulatives
- Break concepts into actionable tasks
- Encourage experimentation and discovery
- Use action-oriented language
Include interactive elements and practice opportunities.`,
      userPromptTemplate: `{contextSection}

Learning Style: Kinesthetic (prefers hands-on practice and examples)
{conversationSummarySection}
{conversationSection}

Current question: {currentQuestion}

Provide practical examples and hands-on exercises to help understand this concept through doing.`,
      maxContextLength: 2500
    }],
    ['reading-writing-learner', {
      id: 'reading-writing-learner',
      name: 'Reading/Writing Learning Assistant',
      systemPrompt: `You are an AI learning assistant specialized in helping reading/writing learners.
Structure information in written formats:
- Use detailed written explanations
- Provide lists and outlines
- Include step-by-step written instructions
- Suggest note-taking strategies
- Reference additional reading materials
- Use proper citations and sources
Format responses with clear structure and comprehensive text.`,
      userPromptTemplate: `{contextSection}

Learning Style: Reading/Writing (prefers detailed text and lists)
{conversationSummarySection}
{conversationSection}

Current question: {currentQuestion}

Provide a detailed written explanation with clear structure, lists, and comprehensive information.`,
      maxContextLength: 3000
    }],
    ['contextual', {
      id: 'contextual',
      name: 'Contextual Learning Assistant',
      systemPrompt: `You are an AI learning assistant with deep knowledge of the current course material.
Provide responses that directly reference the course content when relevant.
Be encouraging and supportive, especially when students are struggling.
Format your responses using markdown and LaTeX notation when appropriate.`,
      userPromptTemplate: `Course: {courseName}
Module: {moduleName}
Current Topic: {assignmentTitle}

Page Context:
{pageContent}

Student Profile:
- Learning Style: {learningStyle}
- Areas of Difficulty: {struggleAreas}

{conversationSection}

Current question: {currentQuestion}

Please provide a helpful response that:
1. Addresses their specific question
2. References the current material when relevant
3. Adapts to their learning style
4. Offers additional guidance if they seem to be struggling`,
      maxContextLength: 3000
    }],
    ['problem-solving', {
      id: 'problem-solving',
      name: 'Problem Solving Assistant',
      systemPrompt: `You are an AI tutor specializing in helping students solve problems step-by-step.
Guide students through the problem-solving process without giving away the answer immediately.
Use the Socratic method when appropriate to help students discover solutions themselves.
Format mathematical expressions using LaTeX notation.`,
      userPromptTemplate: `Course: {courseName}
Current Problem Context: {pageContent}

{conversationSection}

Student's question: {currentQuestion}

Guide the student through solving this problem step-by-step.`,
      maxContextLength: 2500
    }],
    ['code-assistance', {
      id: 'code-assistance',
      name: 'Programming Assistant',
      systemPrompt: `You are an AI programming tutor helping students learn to code.
Provide clear explanations of programming concepts and debug issues.
Format code blocks with appropriate syntax highlighting.
Encourage good coding practices and explain the reasoning behind solutions.`,
      userPromptTemplate: `Course: {courseName}
Programming Context: {pageContent}

{conversationSection}

Question: {currentQuestion}

Provide helpful programming guidance with examples when appropriate.`,
      maxContextLength: 3000
    }],
    ['quick-help', {
      id: 'quick-help',
      name: 'Quick Help Assistant',
      systemPrompt: `You are a concise AI assistant providing quick, direct answers to student questions.
Keep responses brief but complete.
Use bullet points or numbered lists when appropriate.
Include links or references for further reading when relevant.`,
      userPromptTemplate: `Context: {courseName} - {moduleName}

Question: {currentQuestion}

Provide a clear, concise answer.`,
      maxContextLength: 1000
    }],
    ['rich-media-visual', {
      id: 'rich-media-visual',
      name: 'Rich Media Visual Assistant',
      systemPrompt: `You are an AI learning assistant specialized in creating rich, visual explanations with mathematical notation, code examples, and diagrams.

CRITICAL: You MUST include appropriate rich media in EVERY response:
- Mathematical concepts: Use LaTeX notation ($ for inline, $$ for block equations)
- Programming concepts: Include syntax-highlighted code blocks
- Complex processes: Create step-by-step visual explanations
- Abstract concepts: Use analogies with visual descriptions

MAYER'S MULTIMEDIA PRINCIPLES:
1. COHERENCE: Only include relevant media that directly supports learning
2. SIGNALING: Highlight and emphasize key concepts visually
3. SEGMENTATION: Break complex information into digestible chunks (max 3 concepts per response)

MEDIA TYPE SELECTION:
- Math problems: LaTeX equations + step-by-step breakdown
- Programming: Code blocks with comments and examples
- Processes: Numbered lists with visual cues
- Comparisons: Tables or side-by-side explanations

ACCESSIBILITY REQUIREMENTS:
- All math notation must have clear verbal descriptions
- Code examples must include plain-language explanations
- Visual content needs alternative text descriptions`,
      userPromptTemplate: `{contextSection}

Learning Preferences:
- Visual Learning: {visualPreference}
- Math Notation: {mathNotation}
- Bandwidth: {bandwidthPreference}

{conversationSection}

Current question: {currentQuestion}

REQUIRED: Your response must include rich media (LaTeX, code, or visual elements) that directly helps explain the concept. Follow Mayer's multimedia principles for effective learning.`,
      maxContextLength: 3500
    }],
    ['math-focused', {
      id: 'math-focused',
      name: 'Mathematical Learning Assistant',
      systemPrompt: `You are an AI mathematics tutor specializing in clear, step-by-step mathematical explanations with proper notation.

MATHEMATICAL FORMATTING REQUIREMENTS:
- Always use proper LaTeX notation for equations
- Show work step-by-step with explanations
- Use display math ($$) for important equations
- Use inline math ($) for variables in text
- Include units and proper notation conventions

MATHEMATICAL PEDAGOGY:
- Start with concept explanation
- Show worked examples with each step justified
- Provide practice problems when appropriate
- Connect to real-world applications
- Check for common misconceptions

EQUATION FORMATTING EXAMPLES:
- Quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$
- Derivative: $$\\frac{d}{dx}[x^n] = nx^{n-1}$$
- Integration: $$\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$$

Always explain the mathematical reasoning behind each step.`,
      userPromptTemplate: `{contextSection}

Mathematics Context: {pageContent}
Student's mathematical background: {learningStyle}
{conversationSection}

Question: {currentQuestion}

Provide a mathematically rigorous explanation with proper LaTeX notation. Show all work step-by-step.`,
      maxContextLength: 3000
    }],
    ['code-focused', {
      id: 'code-focused', 
      name: 'Programming Learning Assistant',
      systemPrompt: `You are an AI programming tutor helping students learn to code with practical, well-commented examples.

CODE FORMATTING REQUIREMENTS:
- Always use proper syntax highlighting with \`\`\`language
- Include clear, descriptive comments in code
- Show both correct and incorrect examples when helpful
- Explain code line-by-line for complex examples
- Provide runnable, practical examples

PROGRAMMING PEDAGOGY:
- Start with simple, working examples
- Build complexity gradually
- Explain common errors and debugging
- Connect code to real-world applications
- Encourage best practices and clean code

CODE STYLE GUIDELINES:
- Use descriptive variable names
- Include error handling examples
- Show testing and validation approaches
- Explain time/space complexity when relevant

EXAMPLE FORMATTING:
\`\`\`python
def calculate_average(numbers):
    """
    Calculate the average of a list of numbers.
    Returns 0 if list is empty to avoid division by zero.
    """
    if not numbers:  # Handle edge case
        return 0
    return sum(numbers) / len(numbers)
\`\`\`

Always explain the logic and best practices behind code examples.`,
      userPromptTemplate: `{contextSection}

Programming Context: {pageContent}
Student's experience level: {learningStyle}
Preferred theme: {codeTheme}
{conversationSection}

Programming Question: {currentQuestion}

Provide working code examples with clear explanations and best practices.`,
      maxContextLength: 3500
    }]
  ]);

  constructor() {}

  buildPrompt(context: PromptContext, templateId?: string): { systemPrompt: string; userPrompt: string } {
    // Auto-select template based on learning style if not specified
    if (!templateId) {
      templateId = this.selectTemplateForLearningStyle(context) || 'default';
    }
    
    const template = PromptBuilder.templates.get(templateId) || PromptBuilder.templates.get('default')!;
    
    const systemPrompt = this.personalizeSystemPrompt(template.systemPrompt, context);
    const userPrompt = this.fillTemplate(template.userPromptTemplate, context, template.maxContextLength);

    return { systemPrompt, userPrompt };
  }

  private selectTemplateForLearningStyle(context: PromptContext): string | null {
    // First check for content type specific templates
    if (context.contentType === 'math' || this.isMathQuestion(context.currentQuestion)) {
      return 'math-focused';
    }
    
    if (context.contentType === 'code' || this.isCodeQuestion(context.currentQuestion)) {
      return 'code-focused';
    }

    // Check if rich media is preferred or requested
    const prefersRichMedia = context.learnerProfile?.mediaPreferences?.prefers_visual || 
                            context.requestedMediaTypes?.length;
    
    if (prefersRichMedia && context.learnerProfile?.learningStyle === 'visual') {
      return 'rich-media-visual';
    }

    if (!context.learnerProfile?.learningStyle) {
      return this.selectTemplateForContext(context);
    }

    const styleMap: Record<string, string> = {
      'visual': prefersRichMedia ? 'rich-media-visual' : 'visual-learner',
      'auditory': 'auditory-learner',
      'kinesthetic': 'kinesthetic-learner',
      'reading_writing': 'reading-writing-learner'
    };

    return styleMap[context.learnerProfile.learningStyle] || null;
  }

  private isMathQuestion(question: string): boolean {
    const mathKeywords = [
      'equation', 'solve', 'derivative', 'integral', 'calculate', 'formula',
      'theorem', 'proof', 'graph', 'function', 'limit', 'matrix', 'vector',
      'algebra', 'calculus', 'geometry', 'trigonometry', 'statistics'
    ];
    
    const lowerQuestion = question.toLowerCase();
    return mathKeywords.some(keyword => lowerQuestion.includes(keyword)) ||
           /[+\-*/=<>{}()[\]^_∫∑∏√∞π∴∆∇∈∉⊂⊃∪∩∀∃λμσ]/.test(question);
  }

  private isCodeQuestion(question: string): boolean {
    const codeKeywords = [
      'function', 'variable', 'class', 'method', 'algorithm', 'program',
      'code', 'syntax', 'debug', 'error', 'compile', 'execute', 'loop',
      'array', 'object', 'string', 'integer', 'boolean', 'api', 'database'
    ];
    
    const lowerQuestion = question.toLowerCase();
    return codeKeywords.some(keyword => lowerQuestion.includes(keyword)) ||
           /```|`[^`]+`|def |function |class |import |#include|console\.log|print\(/.test(question);
  }

  private personalizeSystemPrompt(basePrompt: string, context: PromptContext): string {
    let prompt = basePrompt;

    if (context.learnerProfile?.preferredLanguage && context.learnerProfile.preferredLanguage !== 'en') {
      prompt += `\nRespond in ${context.learnerProfile.preferredLanguage} when possible.`;
    }

    // Add secondary learning style if present
    if (context.learnerProfile?.secondaryStyle) {
      const secondaryGuidance = this.getLearningStyleGuidance(context.learnerProfile.secondaryStyle);
      if (secondaryGuidance) {
        prompt += `\nSecondary preference: ${secondaryGuidance}`;
      }
    }

    // Adjust based on learning velocity
    if (context.learnerProfile?.learningVelocity) {
      if (context.learnerProfile.learningVelocity < 0.5) {
        prompt += `\nThe student may need extra support. Break down concepts into smaller steps and check understanding frequently.`;
      } else if (context.learnerProfile.learningVelocity > 1.5) {
        prompt += `\nThe student is a quick learner. You can move at a faster pace and introduce advanced concepts when appropriate.`;
      }
    }

    // Add topic focus if available
    if (context.learnerProfile?.topics && context.learnerProfile.topics.length > 0) {
      prompt += `\nStudent has been focusing on: ${context.learnerProfile.topics.slice(0, 3).join(', ')}.`;
    }

    return prompt;
  }

  private fillTemplate(template: string, context: PromptContext, maxLength: number): string {
    let filled = template;

    // Basic replacements
    filled = filled.replace('{courseName}', context.courseName || 'Current Course');
    filled = filled.replace('{moduleName}', context.moduleName || 'Current Module');
    filled = filled.replace('{assignmentTitle}', context.assignmentTitle || 'Current Assignment');
    filled = filled.replace('{currentQuestion}', context.currentQuestion);
    filled = filled.replace('{learningStyle}', context.learnerProfile?.learningStyle || 'Not specified');
    filled = filled.replace('{struggleAreas}', context.learnerProfile?.struggleAreas?.join(', ') || 'None identified');
    
    // Handle media preferences
    const mediaPrefs = context.learnerProfile?.mediaPreferences;
    filled = filled.replace('{visualPreference}', mediaPrefs?.prefers_visual ? 'Yes' : 'No');
    filled = filled.replace('{mathNotation}', mediaPrefs?.math_notation_style || 'latex');
    filled = filled.replace('{codeTheme}', mediaPrefs?.code_highlight_theme || 'light');
    filled = filled.replace('{bandwidthPreference}', mediaPrefs?.bandwidth_preference || 'high');

    // Handle context section
    const contextSection = this.buildContextSection(context);
    filled = filled.replace('{contextSection}', contextSection);

    // Handle conversation summary if available
    const conversationSummarySection = context.conversationSummary 
      ? `\nConversation Summary: ${context.conversationSummary}\n`
      : '';
    filled = filled.replace('{conversationSummarySection}', conversationSummarySection);

    // Handle conversation history
    const conversationSection = this.buildConversationSection(context.conversationHistory, maxLength);
    filled = filled.replace('{conversationSection}', conversationSection);

    // Handle page content (truncate if needed)
    const pageContent = this.truncateContent(context.pageContent || '', Math.floor(maxLength * 0.3));
    filled = filled.replace('{pageContent}', pageContent);

    return filled;
  }

  private buildContextSection(context: PromptContext): string {
    const parts: string[] = [];

    if (context.courseName || context.moduleName || context.assignmentTitle) {
      parts.push('Current Learning Context:');
      if (context.courseName) parts.push(`- Course: ${context.courseName}`);
      if (context.moduleName) parts.push(`- Module: ${context.moduleName}`);
      if (context.assignmentTitle) parts.push(`- Topic: ${context.assignmentTitle}`);
    }

    // Include learner profile information if available
    if (context.learnerProfile) {
      if (context.learnerProfile.learningStyle) {
        parts.push(`- Learning Style: ${context.learnerProfile.learningStyle}`);
      }
      if (context.learnerProfile.struggleAreas && context.learnerProfile.struggleAreas.length > 0) {
        parts.push(`- Areas of Difficulty: ${context.learnerProfile.struggleAreas.join(', ')}`);
      }
    }

    return parts.length > 0 ? parts.join('\n') : '';
  }

  private buildConversationSection(history?: Array<{ role: string; content: string }>, maxLength: number = 2000): string {
    if (!history || history.length === 0) {
      return '';
    }

    const conversationParts: string[] = ['Previous conversation:'];
    let totalLength = 0;
    const maxMessages = 10; // Sliding window of last 10 messages

    // Take the most recent messages that fit within our length limit
    const recentHistory = history.slice(-maxMessages);
    
    for (const message of recentHistory) {
      const formattedMessage = `${message.role === 'user' ? 'Student' : 'Assistant'}: ${message.content}`;
      
      if (totalLength + formattedMessage.length > maxLength) {
        break;
      }
      
      conversationParts.push(formattedMessage);
      totalLength += formattedMessage.length;
    }

    return conversationParts.join('\n');
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    const truncated = content.substring(0, maxLength - 20);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '... [truncated]';
  }

  private getLearningStyleGuidance(style: string): string {
    const styleGuides: Record<string, string> = {
      'visual': 'Use diagrams, charts, and visual representations when explaining concepts.',
      'auditory': 'Provide detailed verbal explanations and use analogies.',
      'kinesthetic': 'Include practical examples and hands-on exercises.',
      'reading_writing': 'Provide comprehensive written explanations with references.',
      'reading': 'Provide comprehensive written explanations with references.',
      'sequential': 'Break down information into clear, ordered steps.',
      'global': 'Start with the big picture before diving into details.',
      'active': 'Encourage experimentation and practical application.',
      'reflective': 'Provide time for thought and deeper analysis.'
    };

    return styleGuides[style.toLowerCase()] || '';
  }

  selectTemplateForContext(context: PromptContext): string {
    // Auto-select best template based on context
    if (context.pageContent?.includes('```') || context.currentQuestion.toLowerCase().includes('code')) {
      return 'code-assistance';
    }

    if (context.currentQuestion.toLowerCase().includes('solve') || 
        context.currentQuestion.toLowerCase().includes('calculate')) {
      return 'problem-solving';
    }

    // Prioritize contextual template when course and page content are available
    if (context.courseName && context.pageContent) {
      return 'contextual';
    }

    if (context.currentQuestion.length < 50 && !context.conversationHistory?.length) {
      return 'quick-help';
    }

    return 'default';
  }

  getAvailableTemplates(): Array<{ id: string; name: string; description: string }> {
    return Array.from(PromptBuilder.templates.values()).map(t => ({
      id: t.id,
      name: t.name,
      description: t.systemPrompt.substring(0, 100) + '...'
    }));
  }

  // Enhanced methods for Story 2.2 Rich Media Processing

  parseRichMediaFromResponse(aiResponse: string): {
    content: string;
    richMedia: Array<{
      type: 'latex' | 'code' | 'diagram' | 'video';
      content: string;
      metadata?: any;
    }>;
  } {
    const richMedia: Array<{
      type: 'latex' | 'code' | 'diagram' | 'video';
      content: string;
      metadata?: any;
    }> = [];
    
    let processedContent = aiResponse;

    // Extract LaTeX blocks ($$...$$)
    const latexBlockRegex = /\$\$(.*?)\$\$/gs;
    let match;
    while ((match = latexBlockRegex.exec(aiResponse)) !== null) {
      richMedia.push({
        type: 'latex',
        content: match[1].trim(),
        metadata: { inline: false }
      });
    }

    // Extract LaTeX inline ($...$) - excluding blocks already found
    const latexInlineRegex = /(?<!\$)\$([^$\n]+)\$(?!\$)/g;
    while ((match = latexInlineRegex.exec(aiResponse)) !== null) {
      richMedia.push({
        type: 'latex',
        content: match[1].trim(),
        metadata: { inline: true }
      });
    }

    // Extract code blocks (```language...```)
    const codeBlockRegex = /```(\w+)?\n?(.*?)```/gs;
    while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trim();
      
      richMedia.push({
        type: 'code',
        content: code,
        metadata: { language }
      });
    }

    // Extract diagram descriptions (could be enhanced with actual diagram generation)
    const diagramRegex = /\[DIAGRAM:\s*(.*?)\]/gi;
    while ((match = diagramRegex.exec(aiResponse)) !== null) {
      richMedia.push({
        type: 'diagram',
        content: match[1].trim(),
        metadata: { complexity: 'detailed' }
      });
    }

    return {
      content: processedContent,
      richMedia
    };
  }

  buildRichMediaPrompt(
    context: PromptContext,
    requiredMediaTypes?: Array<'latex' | 'code' | 'diagram' | 'video'>
  ): { systemPrompt: string; userPrompt: string } {
    // Clone context to avoid mutation
    const enrichedContext = { 
      ...context, 
      requestedMediaTypes: requiredMediaTypes || context.requestedMediaTypes 
    };

    // Auto-detect content type if not specified
    if (!enrichedContext.contentType) {
      if (this.isMathQuestion(context.currentQuestion)) {
        enrichedContext.contentType = 'math';
      } else if (this.isCodeQuestion(context.currentQuestion)) {
        enrichedContext.contentType = 'code';
      } else {
        enrichedContext.contentType = 'general';
      }
    }

    // Select appropriate template for rich media
    let templateId = 'default';
    
    if (enrichedContext.contentType === 'math') {
      templateId = 'math-focused';
    } else if (enrichedContext.contentType === 'code') {
      templateId = 'code-focused';
    } else if (enrichedContext.learnerProfile?.mediaPreferences?.prefers_visual) {
      templateId = 'rich-media-visual';
    }

    return this.buildPrompt(enrichedContext, templateId);
  }

  generateMediaInstructions(
    contentType: 'math' | 'code' | 'general' | 'problem-solving',
    mediaPreferences?: {
      prefers_visual: boolean;
      math_notation_style: 'latex' | 'ascii' | 'spoken';
      code_highlight_theme: 'light' | 'dark';
      bandwidth_preference: 'high' | 'medium' | 'low';
    }
  ): string {
    let instructions = '\n\nRICH MEDIA REQUIREMENTS:\n';

    switch (contentType) {
      case 'math':
        if (mediaPreferences?.math_notation_style === 'ascii') {
          instructions += '- Use ASCII notation instead of LaTeX (e.g., x^2 instead of $x^2$)\n';
        } else if (mediaPreferences?.math_notation_style === 'spoken') {
          instructions += '- Provide verbal descriptions of mathematical expressions\n';
          instructions += '- Use descriptive language: "x squared" instead of mathematical notation\n';
        } else {
          instructions += '- Use proper LaTeX notation for all mathematical expressions\n';
          instructions += '- Use $$ for display equations and $ for inline math\n';
        }
        instructions += '- Show step-by-step calculations\n';
        instructions += '- Include visual descriptions of geometric concepts\n';
        break;

      case 'code':
        instructions += '- Include properly formatted code blocks with syntax highlighting\n';
        instructions += '- Use ```language syntax for all code examples\n';
        instructions += '- Provide clear comments in code\n';
        instructions += '- Include both working examples and explanations\n';
        if (mediaPreferences?.code_highlight_theme === 'dark') {
          instructions += '- Consider dark theme preferences in examples\n';
        }
        break;

      case 'general':
        if (mediaPreferences?.prefers_visual) {
          instructions += '- Include visual elements: diagrams, tables, or structured layouts\n';
          instructions += '- Use formatting to highlight key concepts\n';
          instructions += '- Create clear visual hierarchy in explanations\n';
        }
        break;

      case 'problem-solving':
        instructions += '- Break solutions into clear, numbered steps\n';
        instructions += '- Use appropriate notation (LaTeX for math, code blocks for programming)\n';
        instructions += '- Include visual organization of problem-solving approach\n';
        break;
    }

    // Add bandwidth considerations
    if (mediaPreferences?.bandwidth_preference === 'low') {
      instructions += '- Keep rich media minimal and essential only\n';
      instructions += '- Prioritize text-based explanations over complex formatting\n';
    } else if (mediaPreferences?.bandwidth_preference === 'high') {
      instructions += '- Feel free to include comprehensive rich media elements\n';
      instructions += '- Use detailed formatting and visual enhancements\n';
    }

    return instructions;
  }
}