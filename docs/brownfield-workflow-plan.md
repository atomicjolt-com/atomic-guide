# Brownfield Workflow Plan - Atomic Guide Project

## Project Context
- **Type**: Existing project (brownfield) 
- **Goal**: Add new features
- **Size**: Medium codebase (10K-100K lines)
- **Testing**: Heavy Test Architect involvement required
- **Generated**: 2025-08-22

---

## Phase 1: Requirements Definition
*Timeline: 1-2 hours*

### Actions:
1. **Flatten your codebase**: `npx bmad-method flatten`
2. **Load PM Agent**: `*agent pm`
3. **Create Brownfield PRD**: `*create-brownfield-prd`

### PM Agent will:
- Analyze your existing system
- Interview you about new features
- Identify affected subsystems
- Create focused epic structure
- Define integration requirements

### Deliverables:
- `docs/prd.md` - Complete requirements document
- Clear scope definition
- Risk identification

---

## Phase 2: Risk Assessment
*Timeline: 30-45 minutes*

### Actions:
1. **Load QA Agent**: `*agent qa`
2. **Run Risk Analysis**: `*risk {prd-or-epic}`

### Test Architect will:
- Score regression probability (1-9)
- Map integration complexity
- Identify breaking change potential
- Assess data migration risks
- Recommend mitigation strategies

### Deliverables:
- `docs/qa/assessments/{epic}-risk-{date}.md`
- Risk matrix with probability × impact scores
- Prioritized risk mitigation plan

---

## Phase 3: Architecture Planning
*Timeline: 1-2 hours*

### Actions:
1. **Load Architect Agent**: `*agent architect`
2. **Document Affected Areas**: `*document-project` (focused on PRD scope)
3. **Create Integration Plan**: Review with architect

### Architect will:
- Document ONLY relevant modules
- Design integration approach
- Plan migration strategy if needed
- Define compatibility requirements
- Ensure pattern consistency

### Deliverables:
- `docs/architecture.md` - Focused architecture doc
- Integration diagrams
- Migration approach

---

## Phase 4: Test Strategy
*Timeline: 45-60 minutes*

### Actions:
1. **Load QA Agent**: `*agent qa`
2. **Design Test Plan**: `*design {epic-or-story}`

### Test Architect will:
- Create regression test requirements
- Define test levels (unit/integration/E2E)
- Prioritize test scenarios (P0/P1/P2)
- Plan feature flag testing
- Establish performance baselines

### Deliverables:
- `docs/qa/assessments/{epic}-test-design-{date}.md`
- Test matrix covering old + new functionality
- Performance benchmark requirements

---

## Phase 5: Story Creation
*Timeline: 30 minutes per story*

### Actions:
1. **Load SM Agent**: `*agent sm`
2. **Create Stories**: `*draft` for each feature component
3. **Validate Stories**: `*validate` against requirements

### Scrum Master will:
- Break features into 1-3 day stories
- Include regression test requirements
- Add integration tasks
- Define acceptance criteria
- Include Test Architect checkpoints

### Deliverables:
- `docs/stories/` - Individual story files
- Clear implementation paths
- Test requirements per story

---

## Phase 6: Development
*Timeline: Varies by story complexity*

### For Each Story:

#### Pre-Development:
1. **Review Risk**: Check risk assessment from Phase 2
2. **Review Test Design**: Use as implementation guide

#### During Development:
1. **Load Dev Agent**: `*agent dev`
2. **Implement Story**: `*develop-story {story}`
3. **Mid-Development Testing**:
   - `*trace` - Verify test coverage
   - `*nfr` - Check performance impact

#### Code Quality Checks:
- Run lint/typecheck frequently
- Write tests following test design
- Monitor for regression potential

### Deliverables:
- Implemented features
- Comprehensive test suite
- No regression in existing features

---

## Phase 7: Quality Gates
*Timeline: 30-45 minutes per story*

### Actions:
1. **Load QA Agent**: `*agent qa`
2. **Full Review**: `*review {completed-story}`
3. **Address Issues**: Fix any findings
4. **Update Gate**: `*gate {story}` after fixes

### Test Architect will:
- Perform deep code analysis
- Validate integration safety
- Check regression coverage
- Assess performance impact
- Make gate decision (PASS/CONCERNS/FAIL)

### Deliverables:
- `docs/qa/gates/{story}-gate.yml`
- QA Results in story file
- Documented quality decision

---

## Phase 8: Integration
*Timeline: 1-2 hours*

### Actions:
1. **Final Integration Testing**: Run full test suite
2. **Performance Validation**: Compare against baselines
3. **Create PR**: With comprehensive description
4. **Document Changes**: Update project docs

### Final Checks:
- All tests passing
- No performance degradation
- Feature flags working
- Rollback plan documented
- Migration scripts tested

### Deliverables:
- Merged PR
- Updated documentation
- Deployment-ready code

---

## Critical Success Factors

### ✅ Must Do:
- Run `*risk` before starting any development
- Use `*design` output as implementation guide
- Run `*review` on every story completion
- Document all quality decisions

### ⚠️ Watch For:
- Regression in existing features
- Performance degradation
- Breaking API changes
- Missing test coverage

### 🚀 Optimization Tips:
- Batch similar stories together
- Run Test Architect commands in parallel when possible
- Keep risk assessment visible during development
- Update test design if requirements change

---

## Quick Command Reference

### Phase 1 - Requirements
```bash
npx bmad-method flatten
*agent pm
*create-brownfield-prd
```

### Phase 2 - Risk Assessment
```bash
*agent qa
*risk {prd-or-epic}
```

### Phase 3 - Architecture
```bash
*agent architect
*document-project
```

### Phase 4 - Test Strategy
```bash
*agent qa
*design {epic-or-story}
```

### Phase 5 - Story Creation
```bash
*agent sm
*draft
*validate
```

### Phase 6 - Development
```bash
*agent dev
*develop-story {story}
*trace {story}
*nfr {story}
```

### Phase 7 - Quality Gates
```bash
*agent qa
*review {completed-story}
*gate {story}
```

---

## Success Metrics

This plan ensures:
- **Zero regression defects** through early risk identification
- **Comprehensive test coverage** via Test Architect
- **Safe integration** with existing code
- **Clear quality gates** for go/no-go decisions

---

## Next Steps

1. Run `npx bmad-method flatten` to prepare your codebase
2. Begin with Phase 1: Requirements Definition
3. Follow the phases sequentially for best results
4. Use Test Architect checkpoints throughout development