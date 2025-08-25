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
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  currentQuestion: string;
  conversationSummary?: string;
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
Format your responses using markdown when appropriate.
Support LaTeX math notation by wrapping equations in $ or $$.`,
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
    if (!context.learnerProfile?.learningStyle) {
      return this.selectTemplateForContext(context);
    }

    const styleMap: Record<string, string> = {
      'visual': 'visual-learner',
      'auditory': 'auditory-learner',
      'kinesthetic': 'kinesthetic-learner',
      'reading_writing': 'reading-writing-learner'
    };

    return styleMap[context.learnerProfile.learningStyle] || null;
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
}