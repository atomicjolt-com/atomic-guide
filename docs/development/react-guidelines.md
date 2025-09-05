# React 19 Development Guidelines

This document provides React-specific development guidelines for the Atomic Guide project.

## ⚛️ React 19 Key Features

### Automatic Optimizations

- **React Compiler**: Eliminates need for `useMemo`, `useCallback`, and `React.memo`
- Let the compiler handle performance - write clean, readable code

### Core Features

- **Server Components**: Use for data fetching and static content
- **Actions**: Handle async operations with built-in pending states
- **use() API**: Simplified data fetching and context consumption
- **Document Metadata**: Native support for SEO tags
- **Enhanced Suspense**: Better loading states and error boundaries

## 📏 Component Structure (MANDATORY)

- **MAXIMUM 200 lines** per component file
- **Single responsibility** principle - one component, one purpose
- **Co-locate related files** - styles, tests, types in same folder
- **Export one component** per file as default
- **Name files** matching the component name

## 🔗 Component Integration (STRICT REQUIREMENTS)

- **MUST verify actual prop names** before using components
- **MUST use exact callback parameter types** from component interfaces
- **NEVER assume prop names match semantic expectations**
- **MUST import proper types** for callback parameters

```typescript
// ✅ CORRECT: Verify component interface and use exact prop names
import { EducationList } from './EducationList';
import { EducationSummary } from './schemas';

<EducationList
  cvId={cvId}
  onSelectEducation={(education: EducationSummary) => handleEdit(education.id)}
  onCreateEducation={() => handleCreate()}
  showCreateButton={showActions}  // Verified actual prop name
/>

// ❌ FORBIDDEN: Assuming prop names without verification
<EducationList
  onEditEducation={(education) => handleEdit(education.id)}  // Wrong prop name
  onAddEducation={() => handleCreate()}  // Wrong prop name
/>
```

## ⚡ Performance Guidelines

### React 19 Optimizations

- **Trust the compiler** - avoid manual memoization
- **Use Suspense** for data fetching boundaries
- **Implement code splitting** at route level
- **Lazy load** heavy components

### Bundle Optimization

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'form-vendor': ['react-hook-form', 'zod'],
        },
      },
    },
  },
});
```

### Performance by Default

With React 19's compiler, manual optimizations are largely unnecessary. Focus on clean, readable code and let the compiler handle performance optimizations.

## 🏗️ Design Principles (MUST FOLLOW)

- **Vertical Slice Architecture**: MUST organize by features, not layers
- **Composition Over Inheritance**: MUST use React's composition model

## 📝 React 19 TypeScript Integration (MANDATORY)

- **MUST use `ReactElement` instead of `JSX.Element`** for return types
- **MUST import `ReactElement` from 'react'** explicitly
- **NEVER use `JSX.Element` namespace** - use React types directly

```typescript
// ✅ CORRECT: Modern React 19 typing
import { ReactElement } from 'react';

function MyComponent(): ReactElement {
  return <div>Content</div>;
}

const renderHelper = (): ReactElement | null => {
  return condition ? <span>Helper</span> : null;
};

// ❌ FORBIDDEN: Legacy JSX namespace
function MyComponent(): JSX.Element {
  // Cannot find namespace 'JSX'
  return <div>Content</div>;
}
```

## 🔄 State Management Hierarchy

### MUST Follow This State Hierarchy (STRICT ORDER)

1. **Local State (useState)**
   - Component-specific UI state
   - Form field values before submission
   - Toggle states, modal visibility

   ```typescript
   const [isOpen, setIsOpen] = useState(false);
   ```

2. **Context (Feature-level)**
   - Cross-component state within a single feature
   - Theme preferences, user settings
   - Feature-specific configuration

   ```typescript
   const ThemeContext = createContext<Theme>('light');
   ```

3. **Server State (TanStack Query)**
   - ALL API data fetching and caching
   - Optimistic updates
   - Background refetching

   ```typescript
   const { data, isLoading } = useQuery({
     queryKey: ['user', id],
     queryFn: fetchUser,
     staleTime: 5 * 60 * 1000,
   });
   ```

4. **Global State (Zustand)**
   - ONLY when truly needed app-wide
   - User authentication state
   - App-wide notifications

   ```typescript
   const useAuthStore = create((set) => ({
     user: null,
     login: (user) => set({ user }),
     logout: () => set({ user: null }),
   }));
   ```

5. **URL State (Search Params)**
   - Shareable application state
   - Filters, pagination, search queries
   - Navigation state
   ```typescript
   const [searchParams, setSearchParams] = useSearchParams();
   const page = searchParams.get('page') || '1';
   ```

### State Management Example

```typescript
/**
 * @fileoverview User list with proper state management hierarchy
 */

// 1. Local state for UI
const [selectedTab, setSelectedTab] = useState<'active' | 'archived'>('active');

// 2. Context for feature settings
const { viewMode } = useListContext();

// 3. Server state for data
const { data: users, isLoading } = useQuery({
  queryKey: ['users', selectedTab],
  queryFn: () => fetchUsers(selectedTab),
});

// 4. Global state for auth (if needed)
const { currentUser } = useAuthStore();

// 5. URL state for filters
const [searchParams] = useSearchParams();
const filter = searchParams.get('filter');
```

## 🎬 Actions Example (WITH MANDATORY DOCUMENTATION)

```typescript
/**
 * @fileoverview Contact form using React 19 Actions API
 * @module features/contact/components/ContactForm
 */

import { useActionState, ReactElement } from 'react';

/**
 * Contact form component using React 19 Actions.
 *
 * Leverages the Actions API for automatic pending state management
 * and error handling. Form data is validated with Zod before submission.
 *
 * @component
 * @example
 * ```tsx
 * <ContactForm onSuccess={() => router.push('/thank-you')} />
 * ```
 */
function ContactForm(): ReactElement {
  /**
   * Form action handler with built-in state management.
   *
   * @param previousState - Previous form state (unused in this implementation)
   * @param formData - Raw form data from submission
   * @returns Promise resolving to success or error state
   */
  const [state, submitAction, isPending] = useActionState(async (previousState: any, formData: FormData) => {
    // Extract and validate form data
    const result = contactSchema.safeParse({
      email: formData.get('email'),
      message: formData.get('message'),
    });

    if (!result.success) {
      return { error: result.error.flatten() };
    }

    // Process validated data
    await sendEmail(result.data);
    return { success: true };
  }, null);

  return (
    <form action={submitAction}>
      <button disabled={isPending}>{isPending ? 'Sending...' : 'Send'}</button>
    </form>
  );
}
```

## 🎨 Instant UI Patterns

- Use Suspense boundaries for ALL async operations
- Leverage Server Components for data fetching
- Use the new Actions API for form handling
- Let React Compiler handle optimization

## 📋 Component Templates

```typescript
// Quick component with all states
export function FeatureComponent(): ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['feature'],
    queryFn: fetchFeature
  });

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorBoundary error={error} />;
  if (!data) return <EmptyState />;

  return <FeatureContent data={data} />;
}
```

## 📊 Component Requirements

- **MAX 200 lines** per component file
- **Single responsibility** principle
- **Handle ALL states**: loading, error, empty, success
- **Include ARIA labels** for accessibility

## 🧪 Testing React Components

- **Minimum 80% code coverage** - NO EXCEPTIONS
- **Co-locate tests** in `__tests__` folders next to components
- **Use React Testing Library** for all component tests
- **Test user behavior**, not implementation details
- **Mock external dependencies** appropriately
- **NEVER skip tests** for new features or bug fixes

### Test Example

```typescript
/**
 * @fileoverview Tests for UserProfile component
 * @module features/user/__tests__/UserProfile.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, userEvent } from '@testing-library/react';

describe('UserProfile', () => {
  it('should update user name on form submission', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(<UserProfile onUpdate={onUpdate} />);

    const input = screen.getByLabelText(/name/i);
    await user.type(input, 'John Doe');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'John Doe' }));
  });
});
```

## 🚀 Form Validation with React Hook Form

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

function UserForm(): ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<User>({
    resolver: zodResolver(userSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: User): Promise<void> => {
    // Handle validated data
  };

  return <form onSubmit={handleSubmit(onSubmit)}>{/* Form fields */}</form>;
}
```

## 🚨 Common React Pitfalls

- Using `JSX.Element` instead of `ReactElement`
- Manual optimization when React Compiler handles it
- Not handling all component states (loading, error, empty, success)
- Assuming prop names without verifying component interface
- Bypassing the state management hierarchy
- Creating components over 200 lines
- Not co-locating tests with components

## 📚 Additional Resources

- [React 19 Official Documentation](https://react.dev/blog/2024/12/05/react-19)
- [React Compiler Documentation](https://react.dev/learn/react-compiler)
- [TanStack Query Documentation](https://tanstack.com/query/latest)
- [Zustand Documentation](https://zustand-demo.pmnd.rs/)