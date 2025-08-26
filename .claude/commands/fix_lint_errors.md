---
allowed-tools: Bash(npm:*), Bash(npx:*), Read, Edit, MultiEdit, Grep, Glob, Task
description: Run lint and fix linting/TypeScript errors
---

## Instructions and Context

This command runs the linter, analyzes errors, and fixes them systematically. For TypeScript errors, it analyzes the context to determine proper types and generates new type definitions when necessary.

## Commands

- Run linter: `npm run lint`
- Run linter with auto-fix: `npm run lint-fix`
- Type check only: `npx tsc --noEmit`
- Format check: `npx prettier --check .`

## Process

1. **Initial Lint Check**
   - Run `npm run lint` to identify all linting errors
   - Categorize errors by type (ESLint rules, TypeScript type errors, formatting)

2. **Automated Fixes First**
   - Run `npm run lint-fix` to apply automatic ESLint fixes
   - This handles most style and simple rule violations

3. **Analyze Remaining Errors**
   - For each remaining error, determine the category:
     - TypeScript type errors
     - ESLint rule violations that need manual fixes
     - Import/export issues
     - React/JSX specific issues

4. **Fix TypeScript Errors**
   For each TypeScript error:
   - **Analyze Context**: Read the file and understand the surrounding code
   - **Determine Root Cause**:
     - Missing type definitions
     - Incorrect type usage
     - Need for type assertions or guards
     - Missing generic parameters
   - **Solution Strategy**:
     - If a type is missing, check if it exists elsewhere in the codebase
     - If type doesn't exist, create appropriate interface/type definition
     - Place new types in the most logical location (same file, shared types file, or domain-specific types file)
   - **Implement Fix**: Apply the type fix ensuring it doesn't break other parts

5. **Fix Complex ESLint Issues**
   - For rules that can't be auto-fixed:
     - Understand the rule's purpose
     - Refactor code to comply with the rule
     - Only disable rules with comments as last resort and with clear justification

6. **Verification**
   - Run `npm run lint` again to ensure all errors are resolved
   - Run `npx tsc --noEmit` to verify TypeScript compilation
   - If new errors appear, cycle back to step 3

## Type Creation Guidelines

When creating new TypeScript types:

1. **Location Strategy**:
   - Component-specific types: Define in the same file above the component
   - Shared types: Place in nearest `types.ts` or `types/` directory
   - API types: Group in `api/types.ts` or similar
   - Global types: Use `src/types/` directory

2. **Type Design Principles**:
   - Prefer interfaces for object shapes that might be extended
   - Use type aliases for unions, intersections, and utility types
   - Make types as specific as possible (avoid `any` and overly broad types)
   - Document complex types with JSDoc comments

3. **Common Type Patterns**:

   ```typescript
   // For React props
   interface ComponentProps {
     required: string;
     optional?: number;
     children?: React.ReactNode;
   }

   // For API responses
   interface ApiResponse<T> {
     data: T;
     error?: string;
     status: number;
   }

   // For event handlers
   type EventHandler<T = HTMLElement> = (event: React.MouseEvent<T>) => void;
   ```

## Examples of Fixes

### TypeScript Error: Property does not exist

**Error**: `Property 'customProp' does not exist on type 'HTMLElement'`
**Fix**: Extend the interface or use type assertion

```typescript
interface CustomElement extends HTMLElement {
  customProp: string;
}
// or
(element as CustomElement).customProp;
```

### TypeScript Error: Missing type for function parameter

**Error**: `Parameter 'data' implicitly has an 'any' type`
**Fix**: Define explicit type

```typescript
interface DataType {
  id: string;
  value: number;
}
function processData(data: DataType) { ... }
```

### ESLint Error: React Hook dependency

**Error**: `React Hook useEffect has a missing dependency`
**Fix**: Add dependency or use callback/memo pattern

```typescript
// Add to dependency array
useEffect(() => {
  doSomething(value);
}, [value]);

// Or use useCallback for functions
const stableFunction = useCallback(() => {
  doSomething(value);
}, [value]);
```

## Important Notes

- Always run the linter after making changes to catch cascade effects
- When fixing one error might create others, fix systematically from top to bottom
- Preserve existing code style and patterns when making fixes
- Test that the application still builds after fixes: `npm run build`
