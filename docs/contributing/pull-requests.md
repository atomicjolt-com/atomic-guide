# Pull Request Guidelines

This document provides detailed guidelines for creating, reviewing, and managing pull requests in the Atomic Guide project.

## Overview

Pull requests are the primary mechanism for contributing code changes to Atomic Guide. This process ensures code quality, maintains project standards, and facilitates knowledge sharing among contributors.

## Pre-Pull Request Checklist

### 1. Development Requirements

Before creating a PR, ensure all requirements are met:

**Code Quality:**
- [ ] Code follows TypeScript strict requirements
- [ ] All functions have explicit return types
- [ ] No `any` types used (use `unknown` instead)
- [ ] Proper error handling implemented
- [ ] Input validation with Zod schemas

**Testing:**
- [ ] Unit tests added/updated for new functionality
- [ ] Integration tests added for feature workflows
- [ ] All tests pass: `npm test`
- [ ] Code coverage meets minimum 80%
- [ ] Edge cases and error scenarios tested

**Build and Validation:**
- [ ] TypeScript compiles cleanly: `npm run check`
- [ ] ESLint passes: `npm run lint`
- [ ] Prettier formatting applied
- [ ] No console.log statements (use console.warn/error only)

**Documentation:**
- [ ] JSDoc added for all public functions/classes
- [ ] Component documentation with usage examples
- [ ] README updated if needed
- [ ] API documentation updated for new endpoints

**Database Changes:**
- [ ] Migration files created for schema changes
- [ ] Migrations tested locally
- [ ] Rollback plan documented

## Pull Request Creation

### 1. Branch Naming

Use descriptive branch names following these patterns:

```bash
# Feature branches
feature/video-transcription-improvements
feature/real-time-chat-websockets
feature/lti-deep-linking-support

# Bug fixes
bugfix/canvas-grade-passback-auth-issue
bugfix/memory-leak-in-video-processing
bugfix/cors-error-on-api-endpoints

# Documentation
docs/api-authentication-guide
docs/deployment-cloudflare-setup
docs/contributing-guidelines-update

# Refactoring
refactor/database-service-abstraction
refactor/component-prop-interfaces
refactor/error-handling-standardization

# Performance improvements
perf/video-processing-optimization
perf/database-query-caching
perf/bundle-size-reduction
```

### 2. Commit Message Standards

Follow [Conventional Commits](https://conventionalcommits.org/) specification:

```bash
# Format: type(scope): description
# 
# Types: feat, fix, docs, style, refactor, test, chore, perf, ci
# Scope: Optional, indicates area of change
# Description: Present tense, imperative mood

git commit -m "feat(chat): implement WebSocket-based real-time messaging

- Add ChatRoomDurableObject for connection management  
- Implement message broadcasting with user authentication
- Add typing indicators and presence status
- Include comprehensive error handling and reconnection logic

Closes #123"

git commit -m "fix(lti): resolve Canvas grade passback authentication failure

The grade passback was failing due to expired OAuth tokens. Updated 
token refresh mechanism to handle expiration gracefully.

- Add automatic token refresh before API calls
- Implement exponential backoff for failed requests
- Add comprehensive logging for debugging token issues

Fixes #456"

git commit -m "docs(deployment): add Cloudflare Workers deployment guide

- Document infrastructure setup steps
- Include environment variable configuration
- Add troubleshooting section for common issues
- Provide performance optimization recommendations"
```

### 3. Pull Request Template

Use the following template for all pull requests:

```markdown
## Summary

Brief description of the changes made and the problem they solve.

## Type of Change

- [ ] 🚀 New feature (non-breaking change which adds functionality)
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update (changes to documentation only)
- [ ] 🎨 Style change (formatting, missing semi-colons, etc; no functional changes)
- [ ] 🔧 Refactoring (code changes that neither fix a bug nor add a feature)
- [ ] ⚡ Performance improvement (code changes that improve performance)
- [ ] ✅ Test updates (adding or updating tests)
- [ ] 🔨 Build/CI changes (changes to build process or CI configuration)

## Related Issues

Closes #[issue_number]
Related to #[issue_number]

## Changes Made

### Features Added
- Feature 1: Description of what was added
- Feature 2: Description of what was added

### Bug Fixes
- Bug 1: Description of what was fixed
- Bug 2: Description of what was fixed

### Technical Changes
- Refactored XYZ for better performance
- Updated dependencies to latest versions
- Improved error handling in ABC module

## Testing

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated  
- [ ] End-to-end tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases tested
- [ ] Error scenarios tested

### Test Results
```bash
npm test
# Paste test results showing all tests pass
# Include coverage report if applicable
```

### Manual Testing Steps
1. Step 1: Description of manual test
2. Step 2: Description of manual test
3. Step 3: Description of manual test

## Database Changes

### Migrations
- [ ] Migration files created
- [ ] Migrations tested locally
- [ ] Rollback tested
- [ ] Production deployment plan documented

### Schema Changes
```sql
-- Brief description of schema changes
-- Include migration snippets if relevant
```

## API Changes

### New Endpoints
- `POST /api/new-endpoint` - Description of what it does
- `GET /api/another-endpoint` - Description of what it returns

### Modified Endpoints
- `PUT /api/existing-endpoint` - Description of changes made

### Breaking Changes
- Endpoint X now returns different response format
- Parameter Y is now required for endpoint Z

## Documentation

### Updated Documentation
- [ ] API documentation updated
- [ ] Component documentation updated
- [ ] README updated
- [ ] Architecture docs updated
- [ ] Deployment docs updated

### New Documentation
- [ ] Feature documentation added
- [ ] Usage examples provided
- [ ] Troubleshooting guide updated

## Performance Impact

### Bundle Size
- Before: X MB
- After: Y MB
- Change: ±Z MB

### Performance Metrics
- Response time improvement: X%
- Memory usage change: ±Y MB
- Database query optimization: X% faster

## Security Considerations

- [ ] Input validation implemented
- [ ] Authentication/authorization checked
- [ ] No sensitive data exposed in logs
- [ ] SQL injection prevention verified
- [ ] XSS protection maintained

## Deployment Notes

### Environment Variables
```bash
# New environment variables needed
NEW_VARIABLE=value
ANOTHER_VARIABLE=value
```

### Configuration Changes
- Description of any configuration changes needed
- Steps for updating production environment

### Rollback Plan
1. Step 1 for rolling back changes
2. Step 2 for rolling back changes

## Screenshots/Videos

### Before
[Screenshot of before state]

### After  
[Screenshot of after state]

### Demo Video
[Link to demo video if applicable]

## Checklist

### Code Quality
- [ ] Code follows project style guidelines
- [ ] TypeScript strict mode compliance
- [ ] No `any` types used
- [ ] Proper error handling implemented
- [ ] Input validation with Zod schemas
- [ ] JSDoc documentation added
- [ ] No console.log statements (except console.warn/error)

### Testing
- [ ] All tests pass locally
- [ ] New tests added for new functionality
- [ ] Edge cases covered
- [ ] Error scenarios tested
- [ ] Integration tests pass
- [ ] Code coverage ≥ 80%

### Review
- [ ] Self-review completed
- [ ] Code is self-documenting
- [ ] Complex logic explained with comments
- [ ] Breaking changes documented
- [ ] Security implications considered

## Additional Notes

Any additional context, considerations, or notes for reviewers.

## Reviewer Guidelines

Please check:
1. Code quality and adherence to standards
2. Test coverage and quality
3. Documentation completeness
4. Security considerations
5. Performance implications
6. Breaking change impacts
```

## Review Process

### 1. Automated Checks

All PRs must pass automated checks before review:

**CI Pipeline:**
```yaml
# .github/workflows/pr-validation.yml
name: PR Validation

on:
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: TypeScript check
        run: npm run check
      
      - name: Lint check
        run: npm run lint
      
      - name: Test with coverage
        run: npm test -- --coverage
      
      - name: Build check
        run: npm run build
      
      - name: Security audit
        run: npm audit --audit-level=high
```

**Required Checks:**
- ✅ TypeScript compilation
- ✅ ESLint passes
- ✅ All tests pass
- ✅ Code coverage ≥ 80%
- ✅ Build succeeds
- ✅ Security audit passes

### 2. Manual Review Requirements

**Required Reviewers:**
- At least one maintainer approval required
- Code owner approval for affected areas
- Additional reviewer for breaking changes

**Review Criteria:**

**Code Quality (Required):**
- [ ] Follows TypeScript strict requirements
- [ ] Proper error handling and input validation
- [ ] Code is readable and well-documented
- [ ] No security vulnerabilities introduced
- [ ] Performance considerations addressed

**Architecture (Required):**
- [ ] Changes align with project architecture
- [ ] Proper separation of concerns
- [ ] Follows vertical slice organization
- [ ] Database changes are appropriate

**Testing (Required):**
- [ ] Adequate test coverage (≥80%)
- [ ] Tests are meaningful and comprehensive
- [ ] Edge cases and error scenarios covered
- [ ] Integration tests for feature workflows

**Documentation (Required):**
- [ ] JSDoc documentation complete
- [ ] API changes documented
- [ ] Usage examples provided
- [ ] Breaking changes clearly explained

### 3. Review Comments

**Providing Feedback:**

Use clear, constructive feedback with suggestions:

```markdown
# ✅ GOOD: Constructive feedback with suggestions
**Issue:** This function is missing error handling for the API call.

**Suggestion:**
```typescript
try {
  const response = await fetch('/api/endpoint');
  if (!response.ok) {
    throw new APIError(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
} catch (error) {
  console.error('API call failed:', error);
  throw new ProcessingError('Failed to fetch data', error);
}
```

**Reasoning:** This ensures proper error handling and provides meaningful error messages for debugging.

# ❌ BAD: Vague criticism without suggestions
This doesn't look right. Fix the error handling.
```

**Review Categories:**

Use these labels for review comments:

- 🚨 **BLOCKING:** Must be fixed before merge
- ⚠️ **SUGGESTION:** Recommended improvement  
- 💭 **QUESTION:** Seeking clarification
- 👍 **APPROVAL:** Good implementation
- 📝 **NITPICK:** Minor style/preference issue

### 4. Responding to Reviews

**As PR Author:**

1. **Address all feedback** before requesting re-review
2. **Respond to each comment** with your changes or reasoning
3. **Ask for clarification** if feedback is unclear
4. **Update documentation** if implementation changed significantly
5. **Re-run tests** after making changes

**Example Response:**
```markdown
Thanks for the feedback! I've addressed the issues:

1. ✅ Added proper error handling in `VideoProcessor.processVideo()`
2. ✅ Updated tests to cover the new error scenarios
3. ✅ Added JSDoc documentation for the new error types

Regarding the suggestion about caching - I initially didn't implement it to keep the PR scope focused, but I agree it would be beneficial. I've created #789 to track adding caching in a follow-up PR.

Ready for re-review! 🚀
```

## Merge Process

### 1. Merge Requirements

Before merging, ensure:

- [ ] All automated checks pass
- [ ] Required approvals obtained
- [ ] All review comments resolved
- [ ] Branch is up to date with main
- [ ] No merge conflicts
- [ ] Documentation is complete

### 2. Merge Strategies

**Squash and Merge (Default):**
Use for feature branches with multiple commits:

```bash
# Squash commits into single commit with clear message
git commit -m "feat(video): implement real-time transcription processing

- Add WebSocket-based transcription streaming
- Implement progress tracking and error handling  
- Add comprehensive test coverage
- Update API documentation

Closes #123"
```

**Merge Commit:**
Use for important milestones or release branches:

```bash
# Preserve commit history for significant features
git merge --no-ff feature/major-feature
```

**Rebase and Merge:**
Use for small, clean commits that should preserve individual history:

```bash
# Maintain linear history for small, focused changes
git rebase main
git merge --ff-only
```

### 3. Post-Merge Actions

After successful merge:

1. **Delete feature branch** (automated)
2. **Deploy to staging** for integration testing
3. **Update issue status** and notify stakeholders
4. **Monitor deployment** for any issues
5. **Update documentation** if needed

## Special PR Types

### 1. Hotfix PRs

For critical production issues:

**Process:**
1. Create hotfix branch from main
2. Implement minimal fix with tests
3. Fast-track review with single approval
4. Deploy immediately after merge
5. Follow up with comprehensive fix if needed

**Template:**
```markdown
## 🚨 HOTFIX: Critical Issue Title

### Issue
Critical production issue requiring immediate fix.

### Root Cause
Brief explanation of what caused the issue.

### Fix
Minimal changes made to resolve the issue immediately.

### Testing
- [ ] Issue reproduction confirmed
- [ ] Fix verified in staging
- [ ] Regression testing completed

### Follow-up
Link to comprehensive fix issue: #XXX
```

### 2. Breaking Change PRs

For changes that break existing functionality:

**Requirements:**
- [ ] Breaking changes clearly documented
- [ ] Migration guide provided
- [ ] Backward compatibility considered
- [ ] Version bump planned
- [ ] Stakeholders notified

**Template Addition:**
```markdown
## 💥 Breaking Changes

### What breaks
- API endpoint X now requires authentication
- Component Y props interface changed
- Database schema Z modified

### Migration Guide
1. Update API calls to include authentication
2. Update component usage:
   ```tsx
   // Before
   <Component prop="value" />
   
   // After  
   <Component newProp="value" />
   ```
3. Run migration: `npm run db:migrate`

### Compatibility
- Minimum version: v2.0.0
- Deprecation timeline: 2 weeks
- Support end date: [Date]
```

### 3. Documentation-Only PRs

For documentation improvements:

**Fast-track criteria:**
- Only markdown/documentation files changed
- No code changes
- Single approval sufficient
- Can merge immediately after approval

## Common Issues and Solutions

### 1. Merge Conflicts

**Prevention:**
```bash
# Keep branch updated with main
git checkout main
git pull origin main
git checkout feature-branch
git rebase main
```

**Resolution:**
```bash
# Resolve conflicts manually
git status
# Edit conflicted files
git add .
git rebase --continue
git push --force-with-lease origin feature-branch
```

### 2. Failed CI Checks

**TypeScript Errors:**
```bash
# Fix compilation issues
npm run check
# Address all TypeScript errors before pushing
```

**Test Failures:**
```bash
# Run tests locally
npm test
# Fix failing tests
npm test -- --coverage
# Ensure coverage meets requirements
```

**Linting Issues:**
```bash
# Auto-fix common issues
npm run lint-fix
# Manually fix remaining issues
npm run lint
```

### 3. Large PR Management

**Break down large PRs:**
1. Create tracking issue for overall feature
2. Split into smaller, reviewable PRs
3. Use draft PRs for work in progress
4. Link related PRs in descriptions

**Example Structure:**
```
Epic: Real-time Chat Feature (#100)
├── PR #101: Add WebSocket infrastructure
├── PR #102: Implement message storage
├── PR #103: Build chat UI components  
├── PR #104: Add user presence system
└── PR #105: Integration and testing
```

## Best Practices

### 1. PR Size Guidelines

**Optimal PR size:**
- **Small:** < 100 lines changed (ideal)
- **Medium:** 100-300 lines changed (acceptable)  
- **Large:** 300-500 lines changed (requires justification)
- **Extra Large:** > 500 lines changed (should be split)

### 2. Communication

**In PR descriptions:**
- Be specific about what changed and why
- Include context for business decisions
- Link to relevant issues and discussions
- Provide testing instructions

**During review:**
- Respond promptly to feedback
- Be open to suggestions and alternatives  
- Ask questions if requirements are unclear
- Thank reviewers for their time

### 3. Quality Standards

**Before requesting review:**
- Self-review your own code first
- Test all changed functionality manually
- Verify documentation is accurate
- Check for any debugging code left behind

**Maintain consistency:**
- Follow established patterns in the codebase
- Use existing utilities before creating new ones
- Match the style of surrounding code
- Adhere to naming conventions

By following these pull request guidelines, we maintain high code quality, facilitate effective collaboration, and ensure smooth project evolution.