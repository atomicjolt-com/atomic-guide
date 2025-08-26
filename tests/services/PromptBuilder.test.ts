import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilder, PromptContext } from '../../src/services/PromptBuilder';

describe('PromptBuilder', () => {
  let promptBuilder: PromptBuilder;

  beforeEach(() => {
    promptBuilder = new PromptBuilder();
  });

  describe('buildPrompt', () => {
    it('should build basic prompt with context', () => {
      const context: PromptContext = {
        courseName: 'Biology 101',
        moduleName: 'Plant Biology',
        assignmentTitle: 'Photosynthesis Lab',
        currentQuestion: 'What is photosynthesis?',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      expect(systemPrompt).toContain('concise AI assistant');
      expect(userPrompt).toContain('Biology 101');
      expect(userPrompt).toContain('Plant Biology');
      expect(userPrompt).toContain('What is photosynthesis?');
      // Note: assignmentTitle is not included in quick-help template
    });

    it('should include learner profile when provided', () => {
      const context: PromptContext = {
        courseName: 'Math 101',
        currentQuestion: 'Help me understand this concept',
        learnerProfile: {
          learningStyle: 'visual',
          struggleAreas: ['abstract concepts'],
        },
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      // The visual learning style should be represented either in the template selection
      // or in the context section of the user prompt
      const combinedPrompts = systemPrompt + userPrompt;
      expect(combinedPrompts.toLowerCase()).toContain('visual');
      expect(userPrompt).toContain('abstract concepts');
    });

    it('should handle missing context gracefully', () => {
      const context: PromptContext = {
        currentQuestion: 'Hello',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      expect(userPrompt).toContain('Hello');
      expect(systemPrompt).toContain('concise AI assistant');
      expect(userPrompt).not.toContain('undefined');
      expect(userPrompt).not.toContain('null');
    });

    it('should include page content when available', () => {
      const context: PromptContext = {
        courseName: 'History',
        currentQuestion: 'Explain this',
        pageContent: 'The American Revolution began in 1776...',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'contextual');

      expect(userPrompt).toContain('The American Revolution began in 1776');
    });

    it('should include conversation history', () => {
      const context: PromptContext = {
        courseName: 'Chemistry',
        currentQuestion: 'Can you explain more?',
        conversationHistory: [
          { role: 'user', content: 'What is H2O?' },
          { role: 'assistant', content: 'H2O is water.' },
        ],
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      expect(userPrompt).toContain('Previous conversation');
      expect(userPrompt).toContain('What is H2O?');
      expect(userPrompt).toContain('H2O is water');
    });
  });

  describe('selectTemplateForContext', () => {
    it('should select code-assistance template for code questions', () => {
      const context: PromptContext = {
        currentQuestion: 'How do I write a function in JavaScript?',
        pageContent: '```javascript\nfunction example() {}\n```',
      };

      const templateId = promptBuilder.selectTemplateForContext(context);

      expect(templateId).toBe('code-assistance');
    });

    it('should select problem-solving template for calculation questions', () => {
      const context: PromptContext = {
        currentQuestion: 'How do I solve this equation?',
      };

      const templateId = promptBuilder.selectTemplateForContext(context);

      expect(templateId).toBe('problem-solving');
    });

    it('should select quick-help template for short questions', () => {
      const context: PromptContext = {
        currentQuestion: 'What is DNA?',
      };

      const templateId = promptBuilder.selectTemplateForContext(context);

      expect(templateId).toBe('quick-help');
    });

    it('should select contextual template when course and content available', () => {
      const context: PromptContext = {
        courseName: 'Biology 101',
        pageContent: 'Chapter 5: Cell Division',
        currentQuestion: 'What is mitosis?',
      };

      const templateId = promptBuilder.selectTemplateForContext(context);

      expect(templateId).toBe('contextual');
    });

    it('should default to default template', () => {
      const context: PromptContext = {
        currentQuestion: "This is a longer question that doesn't fit specific patterns",
      };

      const templateId = promptBuilder.selectTemplateForContext(context);

      expect(templateId).toBe('default');
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return list of available templates', () => {
      const templates = promptBuilder.getAvailableTemplates();

      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');

      // Check for expected templates
      const templateIds = templates.map((t) => t.id);
      expect(templateIds).toContain('default');
      expect(templateIds).toContain('contextual');
      expect(templateIds).toContain('problem-solving');
      expect(templateIds).toContain('code-assistance');
      expect(templateIds).toContain('quick-help');
    });
  });

  describe('template-specific functionality', () => {
    it('should use contextual template with full context', () => {
      const context: PromptContext = {
        courseName: 'Physics 101',
        moduleName: 'Mechanics',
        assignmentTitle: "Newton's Laws",
        currentQuestion: 'What is F = ma?',
        learnerProfile: {
          learningStyle: 'visual',
          struggleAreas: ['equations'],
        },
        pageContent: "Newton's second law states that force equals mass times acceleration.",
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'contextual');

      expect(userPrompt).toContain('Physics 101');
      expect(userPrompt).toContain('Mechanics');
      expect(userPrompt).toContain("Newton's Laws");
      expect(userPrompt).toContain('visual');
      expect(userPrompt).toContain('equations');
      expect(userPrompt).toContain('force equals mass times acceleration');
      expect(userPrompt).toContain('What is F = ma?');
    });

    it('should use problem-solving template for math problems', () => {
      const context: PromptContext = {
        courseName: 'Calculus',
        currentQuestion: 'How do I integrate x^2?',
        pageContent: 'Integration techniques chapter',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'problem-solving');

      expect(systemPrompt).toContain('step-by-step');
      expect(systemPrompt).toContain('Socratic method');
      expect(userPrompt).toContain('Calculus');
      expect(userPrompt).toContain('How do I integrate x^2?');
    });

    it('should use code-assistance template for programming', () => {
      const context: PromptContext = {
        courseName: 'Computer Science 101',
        currentQuestion: 'How do I fix this bug?',
        pageContent: 'function calculate() { return x + y }',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'code-assistance');

      expect(systemPrompt).toContain('programming tutor');
      expect(systemPrompt).toContain('code blocks');
      expect(userPrompt).toContain('function calculate()');
    });

    it('should use quick-help template for brief answers', () => {
      const context: PromptContext = {
        courseName: 'History',
        moduleName: 'World War II',
        currentQuestion: 'When did WWII end?',
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'quick-help');

      expect(systemPrompt).toContain('concise');
      expect(systemPrompt).toContain('brief');
      expect(userPrompt).toContain('History');
      expect(userPrompt).toContain('World War II');
    });
  });

  describe('content handling', () => {
    it('should truncate long page content', () => {
      const longContent = 'A'.repeat(5000);
      const context: PromptContext = {
        currentQuestion: 'Test question',
        pageContent: longContent,
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context, 'contextual');

      expect(userPrompt.length).toBeLessThan(4000);
      expect(userPrompt).toContain('[truncated]');
    });

    it('should handle conversation history limits', () => {
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}: ${'A'.repeat(200)}`,
      }));

      const context: PromptContext = {
        currentQuestion: 'Test question',
        conversationHistory: longHistory as any,
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      // Should limit the conversation history
      const messageCount = (userPrompt.match(/Message \d+:/g) || []).length;
      expect(messageCount).toBeLessThanOrEqual(10); // Max 10 messages
    });

    it('should handle preferred language setting', () => {
      const context: PromptContext = {
        currentQuestion: 'What is water?',
        learnerProfile: {
          preferredLanguage: 'Spanish',
        },
      };

      const { systemPrompt, userPrompt } = promptBuilder.buildPrompt(context);

      expect(systemPrompt).toContain('Spanish');
    });
  });
});
