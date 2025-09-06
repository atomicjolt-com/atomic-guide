/**
 * @fileoverview Quality Gate Configuration for Story 5.1
 * 
 * Defines automated quality gates and monitoring criteria for the
 * Struggle Detection + Proactive Chat Interventions system.
 * 
 * This configuration implements the test design strategy requirements
 * with measurable acceptance criteria and automated enforcement.
 */

import { z } from 'zod';

// Base quality gate definition
export const QualityGateSchema = z.object({
  name: z.string().min(1),
  metric: z.string().min(1),
  threshold: z.number(),
  blocking: z.boolean(),
  automatedCheck: z.boolean(),
  description: z.string().optional(),
  category: z.enum(['performance', 'accuracy', 'security', 'privacy', 'quality'])
});

export type QualityGate = z.infer<typeof QualityGateSchema>;

// Quality gate result interface
export interface QualityGateResult {
  gateName: string;
  passed: boolean;
  actualValue: number | null;
  expectedValue: number;
  message: string;
  blocking: boolean;
  category: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// Story 5.1 Quality Gates Configuration
export const STORY_5_1_QUALITY_GATES: QualityGate[] = [
  // PERFORMANCE GATES (BLOCKING)
  {
    name: 'Behavioral Signal Processing Latency P95',
    metric: 'p95_latency_ms',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'Durable Objects must process behavioral signals within 100ms P95 under 1000+ concurrent users'
  },
  {
    name: 'Behavioral Signal Processing Latency P99',
    metric: 'p99_latency_ms',
    threshold: 200,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'P99 latency must stay under 200ms for behavioral signal processing'
  },
  {
    name: 'Struggle Prediction Generation Time',
    metric: 'prediction_generation_time_ms',
    threshold: 10000,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'ML model must generate struggle predictions within 10 seconds'
  },
  {
    name: 'Concurrent User Support Capacity',
    metric: 'max_concurrent_users',
    threshold: 1000,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'System must support minimum 1000 concurrent users without degradation'
  },
  {
    name: 'Signal Processing Throughput',
    metric: 'signals_per_second_per_session',
    threshold: 10,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'Minimum 10 behavioral signals per second per session processing capacity'
  },

  // ACCURACY GATES (BLOCKING)
  {
    name: 'Struggle Detection Precision',
    metric: 'precision_percentage',
    threshold: 70,
    blocking: true,
    automatedCheck: true,
    category: 'accuracy',
    description: 'ML model must achieve >70% precision in struggle detection'
  },
  {
    name: 'Struggle Detection Recall',
    metric: 'recall_percentage',
    threshold: 65,
    blocking: true,
    automatedCheck: true,
    category: 'accuracy',
    description: 'ML model must achieve >65% recall in struggle detection'
  },
  {
    name: 'High Confidence Prediction Accuracy',
    metric: 'high_confidence_accuracy_percentage',
    threshold: 85,
    blocking: true,
    automatedCheck: true,
    category: 'accuracy',
    description: 'High confidence predictions (>0.8) must achieve >85% accuracy'
  },
  {
    name: 'Bias Variance Across Demographics',
    metric: 'max_demographic_accuracy_variance',
    threshold: 20,
    blocking: true,
    automatedCheck: true,
    category: 'accuracy',
    description: 'Accuracy variance across demographic groups must be <20%'
  },

  // SECURITY GATES (BLOCKING)
  {
    name: 'Canvas Origin Bypass Prevention',
    metric: 'origin_bypass_attempts_blocked_percentage',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'security',
    description: 'All Canvas origin bypass attempts must be blocked (100% success rate)'
  },
  {
    name: 'Message Integrity Validation',
    metric: 'hmac_validation_success_rate',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'security',
    description: 'All postMessage communications must have valid HMAC signatures'
  },
  {
    name: 'Input Sanitization Coverage',
    metric: 'sanitization_coverage_percentage',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'security',
    description: 'All behavioral signal inputs must be sanitized and validated'
  },
  {
    name: 'Replay Attack Prevention',
    metric: 'replay_attack_prevention_rate',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'security',
    description: 'All replay attacks must be detected and prevented'
  },

  // PRIVACY GATES (BLOCKING)
  {
    name: 'Consent Enforcement Rate',
    metric: 'consent_validation_success_rate',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'privacy',
    description: 'All behavioral data processing must validate user consent'
  },
  {
    name: 'Data Retention Policy Compliance',
    metric: 'retention_policy_compliance_rate',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'privacy',
    description: 'All data retention policies must be enforced automatically'
  },
  {
    name: 'Anonymization Effectiveness',
    metric: 'anonymization_success_rate',
    threshold: 100,
    blocking: true,
    automatedCheck: true,
    category: 'privacy',
    description: 'Instructor alerts must properly anonymize student data per privacy settings'
  },

  // INTEGRATION GATES (BLOCKING)
  {
    name: 'Canvas Integration Message Delivery',
    metric: 'canvas_message_delivery_success_rate',
    threshold: 99,
    blocking: true,
    automatedCheck: true,
    category: 'performance',
    description: 'Canvas postMessage integration must achieve >99% delivery success rate'
  },
  {
    name: 'Cross-Browser Compatibility',
    metric: 'browser_compatibility_success_rate',
    threshold: 95,
    blocking: true,
    automatedCheck: true,
    category: 'quality',
    description: 'System must work on >95% of tested browser configurations'
  },

  // QUALITY GATES (NON-BLOCKING - Warnings)
  {
    name: 'Unit Test Coverage',
    metric: 'unit_test_coverage_percentage',
    threshold: 80,
    blocking: false,
    automatedCheck: true,
    category: 'quality',
    description: 'Unit test coverage should exceed 80% for all new components'
  },
  {
    name: 'Integration Test Coverage',
    metric: 'integration_test_coverage_percentage',
    threshold: 90,
    blocking: false,
    automatedCheck: true,
    category: 'quality',
    description: 'Integration test coverage should exceed 90% of critical user journeys'
  },
  {
    name: 'Memory Usage per Durable Object',
    metric: 'peak_memory_usage_mb',
    threshold: 500,
    blocking: false,
    automatedCheck: true,
    category: 'performance',
    description: 'Durable Objects should use <500MB peak memory under sustained load'
  },
  {
    name: 'Database Query Performance',
    metric: 'db_query_p95_latency_ms',
    threshold: 50,
    blocking: false,
    automatedCheck: true,
    category: 'performance',
    description: 'Database queries should complete within 50ms P95'
  },
  {
    name: 'User Satisfaction Score',
    metric: 'user_satisfaction_rating',
    threshold: 4.0,
    blocking: false,
    automatedCheck: false,
    category: 'quality',
    description: 'Proactive interventions should achieve >4.0/5.0 helpfulness rating'
  }
];

// Quality gate categories for organization
export const QUALITY_GATE_CATEGORIES = {
  PERFORMANCE: 'performance',
  ACCURACY: 'accuracy',
  SECURITY: 'security',
  PRIVACY: 'privacy',
  QUALITY: 'quality'
} as const;

// Load testing scenarios configuration
export interface LoadTestScenario {
  name: string;
  concurrentUsers: number;
  signalsPerSecond: number;
  durationMinutes: number;
  rampUpTimeSeconds: number;
  successCriteria: {
    latencyP95: number;
    latencyP99: number;
    errorRate: number;
    memoryUsage: number;
    cpuUtilization: number;
  };
}

export const LOAD_TEST_SCENARIOS: LoadTestScenario[] = [
  {
    name: 'Normal Load',
    concurrentUsers: 100,
    signalsPerSecond: 5,
    durationMinutes: 10,
    rampUpTimeSeconds: 60,
    successCriteria: {
      latencyP95: 50,
      latencyP99: 100,
      errorRate: 0.01,
      memoryUsage: 200,
      cpuUtilization: 60
    }
  },
  {
    name: 'Peak Load - Target Capacity',
    concurrentUsers: 1000,
    signalsPerSecond: 10,
    durationMinutes: 15,
    rampUpTimeSeconds: 120,
    successCriteria: {
      latencyP95: 100,
      latencyP99: 200,
      errorRate: 0.1,
      memoryUsage: 500,
      cpuUtilization: 80
    }
  },
  {
    name: 'Spike Load - Stress Test',
    concurrentUsers: 2000,
    signalsPerSecond: 15,
    durationMinutes: 5,
    rampUpTimeSeconds: 30,
    successCriteria: {
      latencyP95: 150,
      latencyP99: 300,
      errorRate: 0.5,
      memoryUsage: 600,
      cpuUtilization: 90
    }
  },
  {
    name: 'Sustained Load - Endurance Test',
    concurrentUsers: 500,
    signalsPerSecond: 8,
    durationMinutes: 120, // 2 hours
    rampUpTimeSeconds: 300,
    successCriteria: {
      latencyP95: 100,
      latencyP99: 200,
      errorRate: 0.1,
      memoryUsage: 400,
      cpuUtilization: 70
    }
  }
];

// Canvas environment configurations for testing
export interface CanvasEnvironmentConfig {
  name: string;
  domains: string[];
  version: string;
  features: string[];
  limitations: string[];
  testPriority: 'high' | 'medium' | 'low';
}

export const CANVAS_TEST_ENVIRONMENTS: CanvasEnvironmentConfig[] = [
  {
    name: 'Canvas Cloud',
    domains: ['canvas.instructure.com', '*.canvas.instructure.com'],
    version: 'latest',
    features: ['postMessage', 'deepLinking', 'namesRoles', 'contentExtraction'],
    limitations: [],
    testPriority: 'high'
  },
  {
    name: 'Institution Hosted',
    domains: ['*.instructure.com'],
    version: 'varies',
    features: ['postMessage', 'deepLinking', 'basicContentExtraction'],
    limitations: ['limited-api-access', 'version-variance'],
    testPriority: 'high'
  },
  {
    name: 'Canvas Community',
    domains: ['community.canvaslms.com', '*.community.canvaslms.com'],
    version: 'open-source',
    features: ['basic-postMessage'],
    limitations: ['no-deep-linking', 'limited-api', 'no-content-extraction'],
    testPriority: 'medium'
  }
];

// Monitoring alert thresholds
export interface AlertThreshold {
  metric: string;
  warningLevel: number;
  criticalLevel: number;
  duration: string; // Duration string like '5m', '1h'
  description: string;
}

export const MONITORING_ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'struggle_prediction_accuracy',
    warningLevel: 0.68,
    criticalLevel: 0.65,
    duration: '10m',
    description: 'ML model prediction accuracy degradation'
  },
  {
    metric: 'behavioral_signal_latency_p95',
    warningLevel: 120,
    criticalLevel: 150,
    duration: '5m',
    description: 'Behavioral signal processing latency increase'
  },
  {
    metric: 'canvas_integration_error_rate',
    warningLevel: 0.02,
    criticalLevel: 0.05,
    duration: '5m',
    description: 'Canvas postMessage integration failure rate'
  },
  {
    metric: 'privacy_consent_violation_rate',
    warningLevel: 0.001,
    criticalLevel: 0.01,
    duration: '1m',
    description: 'Privacy consent validation failures'
  },
  {
    metric: 'durable_object_memory_usage',
    warningLevel: 450,
    criticalLevel: 500,
    duration: '10m',
    description: 'Durable Object memory usage approaching limits'
  },
  {
    metric: 'user_satisfaction_score',
    warningLevel: 3.5,
    criticalLevel: 3.0,
    duration: '1h',
    description: 'User satisfaction with proactive interventions'
  }
];

// Export configuration validation functions
export function validateQualityGateConfig(): boolean {
  try {
    STORY_5_1_QUALITY_GATES.forEach(gate => {
      QualityGateSchema.parse(gate);
    });
    return true;
  } catch (error) {
    console.error('Quality gate configuration validation failed:', error);
    return false;
  }
}

export function getBlockingGates(): QualityGate[] {
  return STORY_5_1_QUALITY_GATES.filter(gate => gate.blocking);
}

export function getNonBlockingGates(): QualityGate[] {
  return STORY_5_1_QUALITY_GATES.filter(gate => !gate.blocking);
}

export function getGatesByCategory(category: string): QualityGate[] {
  return STORY_5_1_QUALITY_GATES.filter(gate => gate.category === category);
}