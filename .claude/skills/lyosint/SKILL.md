```markdown
# lyosint Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill teaches you the core development patterns and conventions used in the `lyosint` TypeScript codebase. You'll learn about file organization, code style, commit practices, and how to write and run tests. These patterns help maintain consistency and readability throughout the project.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `apiClient.ts`

### Import Style
- Use **relative imports** for referencing modules.
  - Example:
    ```typescript
    import { fetchData } from './fetchData';
    ```

### Export Style
- Use **named exports** to expose functions, classes, or constants.
  - Example:
    ```typescript
    // In fetchData.ts
    export function fetchData() { ... }
    ```

### Commit Messages
- Follow **conventional commit** patterns.
- Use the `chore` prefix for maintenance or non-feature commits.
  - Example:
    ```
    chore: update dependencies to latest versions
    ```

## Workflows

### Code Contribution
**Trigger:** When adding new features, fixing bugs, or making improvements  
**Command:** `/contribute`

1. Create a new branch for your changes.
2. Write your code following the coding conventions.
3. Use relative imports and named exports.
4. Write or update corresponding test files (`*.test.*`).
5. Commit your changes with a conventional commit message (e.g., `chore: fix typo in apiClient`).
6. Open a pull request for review.

### Dependency Maintenance
**Trigger:** When dependencies need to be updated or maintained  
**Command:** `/update-deps`

1. Update dependencies as needed.
2. Test the project to ensure compatibility.
3. Commit with a message like `chore: update dependencies`.
4. Push and create a pull request.

## Testing Patterns

- Test files follow the `*.test.*` naming pattern.
  - Example: `fetchData.test.ts`
- The specific testing framework is **unknown**, but tests should be placed alongside or near the code they validate.
- Write clear, isolated tests for each function or module.
  - Example:
    ```typescript
    import { fetchData } from './fetchData';

    test('fetchData returns expected result', () => {
      // test implementation
    });
    ```

## Commands
| Command         | Purpose                                         |
|-----------------|-------------------------------------------------|
| /contribute     | Start the code contribution workflow             |
| /update-deps    | Begin the dependency maintenance workflow        |
```
