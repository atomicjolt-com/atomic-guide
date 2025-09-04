import {  describe, it, expect, beforeEach, vi , MockFactory, TestDataFactory, ServiceTestHarness } from '@/tests/infrastructure';
import { ContentAnalyzer } from '../../src/services/ContentAnalyzer';

import type { MockD1Database, MockKVNamespace, MockQueue } from '@/tests/infrastructure/types/mocks';
describe('ContentAnalyzer', () => {
  let analyzer: ContentAnalyzer;
  let mockAI: any;

  beforeEach(() => {
    mockAI = {
      run: vi.fn()
    };
    analyzer = new ContentAnalyzer(mockAI);
  });

  describe('analyzeContent', () => {
    it('should analyze content and return complete analysis', async () => {
      const mockContent = {
        pageUrl: 'https://canvas.example.com/courses/123/assignments/456',
        pageType: 'assignment',
        content: {
          html: '<h1>Introduction to Machine Learning</h1><p>Machine learning is a subset of artificial intelligence...</p>',
          text: 'Introduction to Machine Learning. Machine learning is a subset of artificial intelligence...',
          title: 'Introduction to Machine Learning',
          metadata: {
            headings: [{ level: 1, text: 'Introduction to Machine Learning' }],
            links: [],
            images: [],
            lists: [],
            emphasis: [{ type: 'bold', text: 'Machine learning' }],
            tables: []
          }
        },
        timestamp: '2024-01-01T00:00:00Z',
        contentHash: 'abc123'
      };

      mockAI.run.mockResolvedValue({
        response: JSON.stringify([
          {
            concept: 'Machine Learning',
            importance: 0.9,
            category: 'definition'
          }
        ])
      });

      const result = await analyzer.analyzeContent(mockContent);

      expect(result).toHaveProperty('keyConcepts');
      expect(result).toHaveProperty('learningObjectives');
      expect(result).toHaveProperty('prerequisiteKnowledge');
      expect(result).toHaveProperty('assessmentOpportunities');
      expect(result.keyConcepts.length).toBeGreaterThan(0);
    });
  });

  describe('extractKeyConcepts', () => {
    it('should extract concepts from headings', async () => {
      const text = 'This is about machine learning and neural networks.';
      const metadata = {
        headings: [
          { level: 1, text: 'Machine Learning Fundamentals' },
          { level: 2, text: 'Neural Networks' }
        ],
        emphasis: []
      };

      mockAI.run.mockResolvedValue({ response: '[]' });

      const concepts = await analyzer.extractKeyConcepts(text, metadata);

      expect(concepts).toBeInstanceOf(Array);
      expect(concepts.some(c => c.concept.includes('Machine Learning'))).toBe(true);
      expect(concepts.some(c => c.concept.includes('Neural Networks'))).toBe(true);
    });

    it('should extract concepts from emphasized text', async () => {
      const text = 'Learn about important concepts.';
      const metadata = {
        headings: [],
        emphasis: [
          { type: 'bold', text: 'Artificial Intelligence' },
          { type: 'italic', text: 'Deep Learning' }
        ]
      };

      mockAI.run.mockResolvedValue({ response: '[]' });

      const concepts = await analyzer.extractKeyConcepts(text, metadata);

      expect(concepts).toBeInstanceOf(Array);
      expect(concepts.some(c => c.concept === 'Artificial Intelligence')).toBe(true);
      expect(concepts.some(c => c.concept === 'Deep Learning')).toBe(true);
    });

    it('should detect definition patterns', async () => {
      const text = 'Regression is defined as a statistical method for modeling relationships. Classification means categorizing data into groups.';
      const metadata = { headings: [], emphasis: [] };

      mockAI.run.mockResolvedValue({ response: '[]' });

      const concepts = await analyzer.extractKeyConcepts(text, metadata);

      expect(concepts.some(c => c.concept.includes('statistical method'))).toBe(true);
      expect(concepts.some(c => c.concept.includes('categorizing data'))).toBe(true);
    });
  });

  describe('identifyLearningObjectives', () => {
    it('should identify explicit learning objectives', async () => {
      const text = 'Learning objectives: Students will be able to explain machine learning concepts. You will learn to apply algorithms to real problems.';
      const metadata = { headings: [] };

      const objectives = await analyzer.identifyLearningObjectives(text, metadata);

      expect(objectives).toBeInstanceOf(Array);
      expect(objectives.length).toBeGreaterThan(0);
      expect(objectives[0]).toHaveProperty('objective');
      expect(objectives[0]).toHaveProperty('bloomLevel');
      expect(objectives[0]).toHaveProperty('confidence');
    });

    it('should detect Bloom taxonomy levels', async () => {
      const text = 'Students will analyze data patterns, evaluate model performance, and create new algorithms.';
      const metadata = { headings: [] };

      const objectives = await analyzer.identifyLearningObjectives(text, metadata);

      expect(objectives.some(o => o.bloomLevel === 'analyze')).toBe(true);
      expect(objectives.some(o => o.bloomLevel === 'evaluate')).toBe(true);
      expect(objectives.some(o => o.bloomLevel === 'create')).toBe(true);
    });
  });

  describe('detectPrerequisites', () => {
    it('should detect explicit prerequisites', async () => {
      const text = 'Prerequisites: understanding of calculus and linear algebra. This course builds upon statistics fundamentals.';

      const prerequisites = await analyzer.detectPrerequisites(text);

      expect(prerequisites).toBeInstanceOf(Array);
      expect(prerequisites.some(p => p.concept.includes('calculus'))).toBe(true);
      expect(prerequisites.some(p => p.concept.includes('linear algebra'))).toBe(true);
      expect(prerequisites.some(p => p.concept.includes('statistics'))).toBe(true);
    });

    it('should detect chapter/module references', async () => {
      const text = 'As discussed in Chapter 3, neural networks require understanding from the previous module.';

      const prerequisites = await analyzer.detectPrerequisites(text);

      expect(prerequisites).toBeInstanceOf(Array);
      expect(prerequisites.some(p => p.concept.includes('Chapter 3'))).toBe(true);
      expect(prerequisites.some(p => p.concept.includes('previous module'))).toBe(true);
    });
  });

  describe('suggestAssessmentPoints', () => {
    it('should suggest comprehension assessments for definitions', async () => {
      const text = 'Machine learning is defined as the study of algorithms. Deep learning refers to neural networks with multiple layers.';
      const metadata = { headings: [] };

      const assessments = await analyzer.suggestAssessmentPoints(text, metadata);

      expect(assessments).toBeInstanceOf(Array);
      expect(assessments.some(a => a.type === 'comprehension')).toBe(true);
      expect(assessments.some(a => a.suggestedQuestionTypes?.includes('definition matching'))).toBe(true);
    });

    it('should suggest application assessments for examples', async () => {
      const text = 'For example, you can use regression to predict house prices. Consider this scenario where classification helps identify spam emails.';
      const metadata = { headings: [] };

      const assessments = await analyzer.suggestAssessmentPoints(text, metadata);

      expect(assessments).toBeInstanceOf(Array);
      expect(assessments.some(a => a.type === 'application')).toBe(true);
      expect(assessments.some(a => a.suggestedQuestionTypes?.includes('problem solving'))).toBe(true);
    });

    it('should suggest analysis assessments for comparisons', async () => {
      const text = 'Unlike supervised learning, unsupervised learning works without labels. However, reinforcement learning differs from both approaches.';
      const metadata = { headings: [] };

      const assessments = await analyzer.suggestAssessmentPoints(text, metadata);

      expect(assessments).toBeInstanceOf(Array);
      expect(assessments.some(a => a.type === 'analysis')).toBe(true);
      expect(assessments.some(a => a.suggestedQuestionTypes?.includes('compare/contrast'))).toBe(true);
    });
  });

  describe('content metrics', () => {
    it('should calculate readability score', async () => {
      const text = 'This is a simple sentence. It has easy words. Students can read it well.';

      const result = await (analyzer).analyzeContentMetrics(text);

      expect(result).toHaveProperty('readabilityScore');
      expect(result.readabilityScore).toBeGreaterThan(0);
      expect(result.readabilityScore).toBeLessThanOrEqual(100);
    });

    it('should estimate reading time', async () => {
      const text = Array(500).fill('word').join(' '); // 500 words

      const result = await (analyzer).analyzeContentMetrics(text);

      expect(result).toHaveProperty('estimatedReadingTime');
      expect(result.estimatedReadingTime).toBe(2); // 500 words / 250 wpm = 2 minutes
    });

    it('should determine content complexity', async () => {
      const simpleText = 'The cat sat on the mat. The dog ran fast.';
      const complexText = 'The epistemological ramifications of quantum entanglement necessitate a paradigmatic shift in our understanding of causality.';

      const simpleResult = await (analyzer).analyzeContentMetrics(simpleText);
      const complexResult = await (analyzer).analyzeContentMetrics(complexText);

      expect(simpleResult.contentComplexity).toBe('basic');
      expect(complexResult.contentComplexity).toBe('advanced');
    });

    it('should identify topic categories', async () => {
      const mathText = 'Solve the equation using algebra. Calculate the derivative of the function. Apply the theorem to prove the formula.';
      const scienceText = 'The experiment tested the hypothesis about molecular reactions in cells and organisms.';

      const mathResult = await (analyzer).analyzeContentMetrics(mathText);
      const scienceResult = await (analyzer).analyzeContentMetrics(scienceText);

      expect(mathResult.topicCategories).toContain('Mathematics');
      expect(scienceResult.topicCategories).toContain('Science');
    });
  });
});