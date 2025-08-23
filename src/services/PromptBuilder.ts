export interface PromptContext {
  courseName?: string;
  moduleName?: string;
  assignmentTitle?: string;
  pageContent?: string;
  learnerProfile?: {
    learningStyle?: string;
    struggleAreas?: string[];
    preferredLanguage?: string;
  };
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  currentQuestion: string;
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

  buildPrompt(context: PromptContext, templateId: string = 'default'): { systemPrompt: string; userPrompt: string } {
    const template = PromptBuilder.templates.get(templateId) || PromptBuilder.templates.get('default')!;
    
    const systemPrompt = this.personalizeSystemPrompt(template.systemPrompt, context);
    const userPrompt = this.fillTemplate(template.userPromptTemplate, context, template.maxContextLength);

    return { systemPrompt, userPrompt };
  }

  private personalizeSystemPrompt(basePrompt: string, context: PromptContext): string {
    let prompt = basePrompt;

    if (context.learnerProfile?.preferredLanguage && context.learnerProfile.preferredLanguage !== 'en') {
      prompt += `\nRespond in ${context.learnerProfile.preferredLanguage} when possible.`;
    }

    if (context.learnerProfile?.learningStyle) {
      const styleGuidance = this.getLearningStyleGuidance(context.learnerProfile.learningStyle);
      if (styleGuidance) {
        prompt += `\n${styleGuidance}`;
      }
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