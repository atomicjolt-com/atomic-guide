#!/usr/bin/env tsx
/**
 * @fileoverview Data generation script for different testing scenarios
 * @module scripts/generate-synthetic-data
 * 
 * Usage:
 * npm run generate-synthetic-data -- --scenario development --count 100
 * npm run generate-synthetic-data -- --scenario privacy-testing --count 500
 * npm run generate-synthetic-data -- --scenario research-validation --count 1000
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { SyntheticDataGenerator } from '../src/features/learner-dna/server/services/SyntheticDataGenerator';
import { SyntheticDataGenerationParams, StudentPersona } from '../src/features/learner-dna/shared/schemas/learner-dna.schema';

interface ScenarioConfig {
  name: string;
  description: string;
  defaultCount: number;
  params: Omit<SyntheticDataGenerationParams, 'studentCount'>;
  seed?: number;
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  development: {
    name: 'Development Dataset',
    description: 'Small, diverse dataset for local development and unit testing',
    defaultCount: 50,
    seed: 12345, // Fixed seed for reproducible development
    params: {
      timeRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-06-30'),
      },
      privacyParams: {
        epsilonBudget: 1.0,
        deltaPrivacy: 1e-5,
        kAnonymity: 3,
      },
      qualityParams: {
        noiseLevelStd: 0.05,
        missingDataRate: 0.02,
        outlierRate: 0.01,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: true,
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: true,
      },
    },
  },

  'privacy-testing': {
    name: 'Privacy Attack Testing Dataset',
    description: 'Dataset designed for comprehensive privacy vulnerability testing',
    defaultCount: 500,
    seed: 54321,
    params: {
      personaDistribution: {
        'fast_learner': 0.15,
        'struggling_student': 0.20,
        'visual_learner': 0.12,
        'auditory_learner': 0.08,
        'kinesthetic_learner': 0.08,
        'perfectionist': 0.10,
        'procrastinator': 0.12,
        'anxious_student': 0.10,
        'confident_student': 0.05,
      } as Record<StudentPersona, number>,
      timeRange: {
        startDate: new Date('2023-09-01'),
        endDate: new Date('2024-08-31'),
      },
      privacyParams: {
        epsilonBudget: 0.5, // Stricter privacy for testing
        deltaPrivacy: 1e-6,
        kAnonymity: 5,
      },
      qualityParams: {
        noiseLevelStd: 0.1,
        missingDataRate: 0.05,
        outlierRate: 0.02,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: true,
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: true,
      },
    },
  },

  'research-validation': {
    name: 'Research Pattern Validation Dataset',
    description: 'Large dataset for validating educational psychology research patterns',
    defaultCount: 1000,
    seed: 98765,
    params: {
      timeRange: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2024-12-31'),
      },
      privacyParams: {
        epsilonBudget: 2.0,
        deltaPrivacy: 1e-4,
        kAnonymity: 3,
      },
      qualityParams: {
        noiseLevelStd: 0.08,
        missingDataRate: 0.03,
        outlierRate: 0.015,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: true,
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: true,
      },
    },
  },

  'performance-testing': {
    name: 'Performance Testing Dataset',
    description: 'Large dataset for testing system performance and scalability',
    defaultCount: 5000,
    params: {
      timeRange: {
        startDate: new Date('2022-01-01'),
        endDate: new Date('2024-12-31'),
      },
      privacyParams: {
        epsilonBudget: 5.0, // Higher epsilon for performance testing
        deltaPrivacy: 1e-3,
        kAnonymity: 2,
      },
      qualityParams: {
        noiseLevelStd: 0.15,
        missingDataRate: 0.08,
        outlierRate: 0.03,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: false, // Faster generation
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: false, // Faster generation
      },
    },
  },

  'edge-cases': {
    name: 'Edge Cases Dataset',
    description: 'Dataset with extreme personas and edge cases for robustness testing',
    defaultCount: 200,
    seed: 11111,
    params: {
      personaDistribution: {
        'struggling_student': 0.25,
        'anxious_student': 0.20,
        'perfectionist': 0.15,
        'gifted_underachiever': 0.10,
        'math_phobic': 0.10,
        'at_risk_student': 0.10,
        'neurodivergent_learner': 0.10,
      } as Record<StudentPersona, number>,
      timeRange: {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      },
      privacyParams: {
        epsilonBudget: 1.0,
        deltaPrivacy: 1e-5,
        kAnonymity: 3,
      },
      qualityParams: {
        noiseLevelStd: 0.2, // Higher noise for edge cases
        missingDataRate: 0.1,
        outlierRate: 0.05,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: true,
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: true,
      },
    },
  },

  'ml-training': {
    name: 'Machine Learning Training Dataset',
    description: 'Balanced dataset optimized for training learning analytics models',
    defaultCount: 2000,
    seed: 77777,
    params: {
      personaDistribution: {
        'fast_learner': 0.12,
        'struggling_student': 0.18,
        'visual_learner': 0.10,
        'auditory_learner': 0.08,
        'kinesthetic_learner': 0.08,
        'perfectionist': 0.08,
        'procrastinator': 0.10,
        'anxious_student': 0.08,
        'confident_student': 0.08,
        'collaborative_learner': 0.05,
        'independent_learner': 0.05,
      } as Record<StudentPersona, number>,
      timeRange: {
        startDate: new Date('2023-01-01'),
        endDate: new Date('2024-12-31'),
      },
      privacyParams: {
        epsilonBudget: 3.0,
        deltaPrivacy: 1e-4,
        kAnonymity: 4,
      },
      qualityParams: {
        noiseLevelStd: 0.06,
        missingDataRate: 0.04,
        outlierRate: 0.02,
      },
      realismConstraints: {
        enforcePsychologicalConsistency: true,
        applyEducationalResearchPatterns: true,
        includeIndividualVariability: true,
        generateTemporalCorrelations: true,
      },
    },
  },
};

async function generateSyntheticData() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const scenarioIndex = args.indexOf('--scenario');
  const countIndex = args.indexOf('--count');
  const outputIndex = args.indexOf('--output');
  const formatIndex = args.indexOf('--format');
  
  const scenario = scenarioIndex >= 0 ? args[scenarioIndex + 1] : 'development';
  const customCount = countIndex >= 0 ? parseInt(args[countIndex + 1]) : undefined;
  const outputDir = outputIndex >= 0 ? args[outputIndex + 1] : 'generated-data';
  const format = formatIndex >= 0 ? args[formatIndex + 1] : 'json';

  if (!SCENARIOS[scenario]) {
    console.error(`Unknown scenario: ${scenario}`);
    console.error(`Available scenarios: ${Object.keys(SCENARIOS).join(', ')}`);
    process.exit(1);
  }

  const config = SCENARIOS[scenario];
  const studentCount = customCount || config.defaultCount;

  console.log(`🎯 Generating ${config.name}`);
  console.log(`📊 Student count: ${studentCount}`);
  console.log(`📝 Description: ${config.description}`);
  console.log(`📁 Output directory: ${outputDir}`);
  console.log('🔄 Starting generation...\\n');

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Initialize generator
  const generator = new SyntheticDataGenerator(config.seed);

  // Generate dataset
  const startTime = Date.now();
  const params: SyntheticDataGenerationParams = {
    ...config.params,
    studentCount,
  };

  const dataset = await generator.generateSyntheticDataset(params);
  const generationTime = Date.now() - startTime;

  // Generate summary statistics
  const summary = {
    scenario: config.name,
    generationParams: params,
    generatedAt: new Date().toISOString(),
    generationTimeMs: generationTime,
    statistics: {
      profileCount: dataset.profiles.length,
      sessionCount: dataset.sessions.length,
      privacyAttackCount: dataset.privacyAttacks.length,
      
      // Profile statistics
      personaDistribution: getPersonaDistribution(dataset.profiles),
      demographicSummary: getDemographicSummary(dataset.profiles),
      
      // Session statistics
      avgSessionDuration: getAverageSessionDuration(dataset.sessions),
      avgQuestionsPerSession: getAverageQuestionsPerSession(dataset.sessions),
      avgAccuracy: getAverageAccuracy(dataset.sessions),
      
      // Privacy statistics
      privacyAttackSuccess: getPrivacyAttackStats(dataset.privacyAttacks),
    },
    qualityMetrics: dataset.qualityMetrics,
  };

  // Save data in requested format
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseFilename = `${scenario}-${studentCount}-${timestamp}`;

  if (format === 'json' || format === 'both') {
    // Save as single JSON file
    const jsonOutput = {
      metadata: summary,
      data: dataset,
    };
    
    const jsonPath = join(outputDir, `${baseFilename}.json`);
    writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`✅ JSON data saved to: ${jsonPath}`);
  }

  if (format === 'csv' || format === 'both') {
    // Save as separate CSV files for each data type
    saveToCsv(dataset.profiles, join(outputDir, `${baseFilename}-profiles.csv`));
    saveToCsv(dataset.sessions, join(outputDir, `${baseFilename}-sessions.csv`));
    saveToCsv(dataset.privacyAttacks, join(outputDir, `${baseFilename}-privacy-attacks.csv`));
    console.log(`✅ CSV data saved to: ${outputDir}/${baseFilename}-*.csv`);
  }

  // Always save summary
  const summaryPath = join(outputDir, `${baseFilename}-summary.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Summary saved to: ${summaryPath}`);

  // Print generation report
  console.log('\\n📈 Generation Report:');
  console.log(`⏱️  Generation time: ${(generationTime / 1000).toFixed(2)} seconds`);
  console.log(`👥 Profiles generated: ${dataset.profiles.length}`);
  console.log(`📚 Sessions generated: ${dataset.sessions.length}`);
  console.log(`🔒 Privacy attacks simulated: ${dataset.privacyAttacks.length}`);
  console.log(`🎯 Average accuracy: ${(summary.statistics.avgAccuracy * 100).toFixed(1)}%`);
  console.log(`🔐 Re-identification risk: ${(dataset.qualityMetrics.privacyMetrics.reidentificationRisk * 100).toFixed(1)}%`);
  console.log(`📊 Educational research compliance: ${(dataset.qualityMetrics.psychologyCompliance.ebbinghausCorrelation * 100).toFixed(1)}%`);

  console.log('\\n✨ Generation completed successfully!');
}

function getPersonaDistribution(profiles: any[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  profiles.forEach(profile => {
    distribution[profile.persona] = (distribution[profile.persona] || 0) + 1;
  });
  
  // Convert to percentages
  const total = profiles.length;
  Object.keys(distribution).forEach(persona => {
    distribution[persona] = Math.round((distribution[persona] / total) * 100) / 100;
  });
  
  return distribution;
}

function getDemographicSummary(profiles: any[]): any {
  const ageGroups: Record<string, number> = {};
  const academicLevels: Record<string, number> = {};
  
  profiles.forEach(profile => {
    const age = profile.demographics.ageGroup;
    const level = profile.demographics.academicLevel;
    
    ageGroups[age] = (ageGroups[age] || 0) + 1;
    academicLevels[level] = (academicLevels[level] || 0) + 1;
  });
  
  return { ageGroups, academicLevels };
}

function getAverageSessionDuration(sessions: any[]): number {
  const total = sessions.reduce((sum, session) => sum + session.duration, 0);
  return Math.round(total / sessions.length);
}

function getAverageQuestionsPerSession(sessions: any[]): number {
  const total = sessions.reduce((sum, session) => sum + session.questionsAnswered, 0);
  return Math.round((total / sessions.length) * 10) / 10;
}

function getAverageAccuracy(sessions: any[]): number {
  const accuracies = sessions.map(session => 
    session.questionsAnswered > 0 ? session.correctAnswers / session.questionsAnswered : 0
  );
  return accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
}

function getPrivacyAttackStats(attacks: any[]): Record<string, any> {
  const attackTypes: Record<string, { total: number; successful: number }> = {};
  
  attacks.forEach(attack => {
    if (!attackTypes[attack.attackType]) {
      attackTypes[attack.attackType] = { total: 0, successful: 0 };
    }
    attackTypes[attack.attackType].total++;
    if (attack.attackSuccess) {
      attackTypes[attack.attackType].successful++;
    }
  });
  
  // Calculate success rates
  const result: Record<string, any> = {};
  Object.keys(attackTypes).forEach(type => {
    const stats = attackTypes[type];
    result[type] = {
      total: stats.total,
      successful: stats.successful,
      successRate: Math.round((stats.successful / stats.total) * 100) / 100,
    };
  });
  
  return result;
}

function saveToCsv(data: any[], filePath: string): void {
  if (data.length === 0) return;
  
  // Extract headers from first object (flatten nested objects)
  const flattenObject = (obj: any, prefix = ''): any => {
    const flattened: any = {};
    
    for (const key in obj) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}_${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    }
    
    return flattened;
  };
  
  const flatData = data.map(item => flattenObject(item));
  const headers = Object.keys(flatData[0]);
  
  // Create CSV content
  const csvRows = [
    headers.join(','),
    ...flatData.map(row => 
      headers.map(header => {
        const value = row[header];
        const stringValue = value != null ? String(value) : '';
        // Escape quotes and wrap in quotes if contains comma or quote
        return stringValue.includes(',') || stringValue.includes('"') 
          ? `"${stringValue.replace(/"/g, '""')}"` 
          : stringValue;
      }).join(',')
    )
  ];
  
  writeFileSync(filePath, csvRows.join('\\n'));
}

// Show usage if no arguments provided
if (process.argv.length === 2) {
  console.log('🧬 Synthetic Data Generator for Learner DNA\\n');
  console.log('Usage: npm run generate-synthetic-data -- [options]\\n');
  console.log('Options:');
  console.log('  --scenario <name>     Scenario to generate (default: development)');
  console.log('  --count <number>      Number of students (default: varies by scenario)');
  console.log('  --output <directory>  Output directory (default: generated-data)');
  console.log('  --format <json|csv|both>  Output format (default: json)\\n');
  console.log('Available scenarios:');
  
  Object.entries(SCENARIOS).forEach(([key, config]) => {
    console.log(`  ${key.padEnd(20)} ${config.description} (${config.defaultCount} students)`);
  });
  
  console.log('\\nExamples:');
  console.log('  npm run generate-synthetic-data -- --scenario development');
  console.log('  npm run generate-synthetic-data -- --scenario privacy-testing --count 1000');
  console.log('  npm run generate-synthetic-data -- --scenario research-validation --format both');
  
  process.exit(0);
}

// Run the generation
generateSyntheticData().catch(error => {
  console.error('❌ Generation failed:', error);
  process.exit(1);
});