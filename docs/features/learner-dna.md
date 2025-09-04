# Learner DNA - Synthetic Data Framework

## Overview

The Learner DNA Synthetic Data Framework provides comprehensive synthetic data generation for educational psychology research and learning analytics development. This framework enables safe development and testing of cognitive algorithms without exposing real student data.

## Key Features

- **Educational Psychology Compliance**: All algorithms are based on established research (Ebbinghaus, VARK, Cognitive Load Theory, etc.)
- **Privacy Protection**: Includes privacy attack testing and differential privacy mechanisms
- **Realistic Behavioral Patterns**: Generates authentic learning trajectories and interaction patterns
- **Student Personas**: 20+ different student archetypes with consistent psychological profiles
- **Comprehensive Testing**: Extensive unit tests validate research pattern compliance

## Core Components

### SyntheticDataGenerator

The main service that generates realistic learning data:

```typescript
import { SyntheticDataGenerator } from '@features/learner-dna/server/services/SyntheticDataGenerator';

const generator = new SyntheticDataGenerator(12345); // Fixed seed for reproducibility

// Generate a cognitive profile
const profile = generator.generateCognitiveProfile('fast_learner');

// Generate learning sessions
const concepts = ['algebra', 'calculus'];
const session = generator.generateLearningSession(profile, concepts);

// Generate complete dataset
const params = {
  studentCount: 100,
  timeRange: { startDate: new Date('2024-01-01'), endDate: new Date('2024-12-31') },
  privacyParams: { epsilonBudget: 1.0, deltaPrivacy: 1e-5, kAnonymity: 3 },
  qualityParams: { noiseLevelStd: 0.1, missingDataRate: 0.05, outlierRate: 0.02 },
  realismConstraints: {
    enforcePsychologicalConsistency: true,
    applyEducationalResearchPatterns: true,
    includeIndividualVariability: true,
    generateTemporalCorrelations: true,
  }
};

const dataset = await generator.generateSyntheticDataset(params);
```

### Student Personas

Predefined psychological profiles based on learning science:

- `fast_learner` - High learning velocity, strong memory retention
- `struggling_student` - Lower cognitive load capacity, higher confusion tendency  
- `visual_learner` - High visual preference in VARK model
- `perfectionist` - Low frustration tolerance, high persistence
- `anxious_student` - High anxiety sensitivity, longer response times
- `procrastinator` - High procrastination factor, shorter sessions
- And 15+ more personas covering diverse learning styles

### Research Foundations

#### Ebbinghaus Forgetting Curve
```typescript
// Memory retention calculation over time
const retention = generator.calculateMemoryRetention(curve, timeElapsedHours, spacedRepetitions);

// Expected pattern: R(t) = a*e^(-bt) + c
// Where: a = initial retention, b = decay constant, c = asymptotic retention
```

#### VARK Learning Styles
```typescript
// Generates realistic distributions matching Fleming's research
const style = generator.generateComprehensionStyle();
// Visual: ~35%, Auditory: ~25%, Kinesthetic: ~20%, Reading/Writing: ~20%
```

#### Cognitive Load Theory
```typescript
// Working memory capacity follows Miller's 7±2 rule
const patterns = generator.generateStrugglePatternIndicators();
// cognitiveLoadCapacity: normally distributed around 1.0
```

### Privacy Protection

The framework includes comprehensive privacy attack testing:

```typescript
const attacks = [
  'linkage_attack',       // Demographic fingerprinting
  'membership_inference', // Shadow model attacks
  'attribute_inference',  // Behavioral correlation analysis
  'reconstruction_attack', // Profile reconstruction from partial data
  'differential_attack'   // Query difference analysis
];

const attackData = generator.generatePrivacyAttackData(targetProfile, allProfiles, 'linkage_attack');
```

### Data Quality Validation

Automated validation against educational psychology research:

```typescript
const qualityMetrics = {
  psychologyCompliance: {
    ebbinghausCorrelation: 0.89,     // Matches forgetting curve research
    learningCurveRealism: 0.85,      // Realistic progression patterns
    strugglePatternValidity: 0.80,   // Consistent with learning difficulties
  },
  privacyMetrics: {
    reidentificationRisk: 0.15,      // Low re-identification risk
    attributeInferenceAccuracy: 0.25, // Protected sensitive attributes
    linkageAttackSuccess: 0.18,      // Resistant to linkage attacks
  },
  utilityMetrics: {
    queryAccuracy: 0.88,            // High utility for analytics
    statisticalUtility: 0.85,       // Preserves statistical patterns
    machineLearningUtility: 0.82,   // Suitable for ML training
  }
};
```

## Integration with Analytics

The `LearnerDNAIntegration` service bridges synthetic data with existing dashboard analytics:

```typescript
import { LearnerDNAIntegration } from '@features/learner-dna/server/services/LearnerDNAIntegration';

const integration = new LearnerDNAIntegration(db, kvNamespace);

// Generate synthetic student profiles for development
const studentIds = await integration.generateSyntheticPerformanceProfiles(
  tenantId, 
  courseId, 
  50 // Generate 50 synthetic students
);

// Validate synthetic data quality against real patterns
const qualityReport = await integration.validateSyntheticDataQuality(tenantId, studentIds);
```

## Data Generation Scripts

Use the command-line interface for different scenarios:

```bash
# Development dataset (50 students, high quality)
npm run generate-synthetic-data -- --scenario development

# Privacy testing (500 students, strict privacy)
npm run generate-synthetic-data -- --scenario privacy-testing --count 1000

# Research validation (1000 students, educational research patterns)
npm run generate-synthetic-data -- --scenario research-validation --format both

# Performance testing (5000 students, optimized generation)
npm run generate-synthetic-data -- --scenario performance-testing

# Edge cases (200 students, difficult personas)
npm run generate-synthetic-data -- --scenario edge-cases

# ML training (2000 students, balanced distribution)
npm run generate-synthetic-data -- --scenario ml-training --output ml-datasets
```

### Available Scenarios

| Scenario | Students | Purpose | Privacy Level |
|----------|----------|---------|---------------|
| development | 50 | Local dev/testing | Medium (ε=1.0) |
| privacy-testing | 500 | Privacy vulnerability testing | High (ε=0.5) |
| research-validation | 1000 | Educational research compliance | Medium (ε=2.0) |
| performance-testing | 5000 | System scalability testing | Low (ε=5.0) |
| edge-cases | 200 | Robustness testing | Medium (ε=1.0) |
| ml-training | 2000 | Machine learning datasets | Medium (ε=3.0) |

## Testing

Comprehensive test coverage ensures quality and research compliance:

```bash
# Run all synthetic data tests
npm test src/features/learner-dna/

# Run research pattern validation
npm test src/features/learner-dna/tests/ResearchPatternValidation.test.ts

# Run specific generator tests
npm test src/features/learner-dna/tests/SyntheticDataGenerator.test.ts
```

### Test Coverage

- **Unit Tests**: All generation algorithms with edge cases
- **Research Validation**: Compliance with educational psychology research
- **Privacy Testing**: Attack resistance and privacy preservation
- **Integration Tests**: Compatibility with existing analytics
- **Performance Tests**: Generation speed and memory usage

## Research Compliance

### Validated Research Patterns

✅ **Ebbinghaus Forgetting Curve** - Memory retention follows R(t) = a*e^(-bt) + c pattern  
✅ **VARK Learning Styles** - Distribution matches Fleming's research (Visual 35%, Auditory 25%, etc.)  
✅ **Cognitive Load Theory** - Working memory limits follow Miller's 7±2 rule  
✅ **Circadian Rhythms** - Time-of-day performance patterns match chronobiology research  
✅ **Help-Seeking Behavior** - Correlates with struggle patterns and individual differences  
✅ **Learning Velocity** - Follows power law learning curves with individual variation  
✅ **Response Time Distributions** - Log-normal distributions typical of cognitive tasks  

### Academic References

- Ebbinghaus, H. (1885). *Memory: A contribution to experimental psychology*
- Fleming, N.D. (1987). *VARK: A guide to learning styles*  
- Sweller, J. (1988). *Cognitive load during problem solving*
- Miller, G.A. (1956). *The magical number seven, plus or minus two*
- Cepeda, N.J. et al. (2006). *Distributed practice in verbal recall tasks*

## Privacy and Ethics

### Privacy Safeguards

- **Differential Privacy**: Configurable ε and δ parameters
- **k-Anonymity**: Demographic grouping constraints
- **Attack Resistance**: Tested against 5 types of privacy attacks
- **Data Minimization**: Only generates necessary attributes
- **Consent Simulation**: Models privacy consent patterns

### Ethical Considerations

- **No Real Student Data**: Purely synthetic generation
- **Bias Mitigation**: Balanced persona distributions  
- **Transparency**: Open source algorithms and parameters
- **Auditability**: Full logging and quality metrics
- **Educational Benefit**: Enables safer learning analytics research

## API Reference

### Core Classes

#### `SyntheticDataGenerator`
Main class for generating synthetic learning data.

**Methods:**
- `generateCognitiveProfile(persona?: StudentPersona): CognitiveProfile`
- `generateLearningSession(profile, concepts, date?): LearningSessionData`
- `generateSyntheticDataset(params): Promise<Dataset>`
- `calculateMemoryRetention(curve, hours, repetitions): number`
- `calculateLearningVelocity(pattern, studyTime, breakTime, timeOfDay): number`

#### `LearnerDNAIntegration`  
Integration service for existing analytics infrastructure.

**Methods:**
- `generateSyntheticPerformanceProfiles(tenant, course, count): Promise<string[]>`
- `validateSyntheticDataQuality(tenant, studentIds): Promise<QualityReport>`
- `createSyntheticBenchmarks(tenant, course, students): Promise<void>`

### Data Types

All types are fully documented with Zod schemas for runtime validation:

- `CognitiveProfile` - Complete student psychological profile
- `LearningSessionData` - Individual learning session with behavioral data
- `MemoryRetentionCurve` - Ebbinghaus curve parameters
- `InteractionTimingPattern` - Response time and engagement patterns
- `ComprehensionStyle` - VARK learning style preferences
- `StrugglePatternIndicators` - Difficulty and help-seeking behaviors

## Implementation Details

The Learner DNA framework is implemented as a feature module in `/src/features/learner-dna/` with:

- **Server Services**: Core generation and integration logic
- **Client Components**: Visualization and configuration UI
- **Shared Types**: Common data structures and schemas
- **Comprehensive Tests**: Validation of all research patterns

## Contributing

When adding new personas or algorithms:

1. **Research Foundation**: Base on published educational psychology research
2. **Validation Tests**: Add tests comparing to research findings  
3. **Privacy Review**: Ensure new data doesn't increase re-identification risk
4. **Documentation**: Update persona profiles and research references
5. **Integration**: Test with existing analytics infrastructure

## Related Documentation

- [Analytics Dashboard](./analytics.md) - Performance tracking features
- [Privacy Policy](../privacy/data-protection.md) - Data handling practices
- [Architecture Overview](../architecture/index.md) - System design
- [Testing Guide](../development/testing.md) - Test implementation