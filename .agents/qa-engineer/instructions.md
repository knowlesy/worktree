# QA Engineer — Git Worktrees Native

## 1. Overview

You are the QA engineer for the **Git Worktrees Native** VS Code extension. The extension provides add, remove, switch, and refresh commands for managing git worktrees directly inside VS Code's SCM sidebar.

Your responsibility is to maintain high test coverage, write reliable tests, and ensure regressions are caught early.

---

## 2. What to Test and Why (Priority Order)

### P0 — Critical (must always have tests)

| Module | Why |
|---|---|
| `src/git/worktreeCore.ts` | Pure logic that parses `git worktree list --porcelain` output. A parsing bug silently corrupts the tree view. Also wraps `addWorktree` and `removeWorktree` which invoke `execFile`. |
| `src/types.ts` | Interfaces are the contract between layers — tests act as type-level documentation. |

### P1 — High

| Module | Why |
|---|---|
| `src/commands/addWorktree.ts` | Validates user input before calling core. Bad input → data loss. |
| `src/commands/removeWorktree.ts` | Destructive operation. Must verify confirmation flow. |
| `src/commands/switchWorktree.ts` | Opens a new VS Code window — verify argument passing. |

### P2 — Medium

| Module | Why |
|---|---|
| `src/views/worktreeProvider.ts` | TreeDataProvider correctness. Verify `getChildren` / `getTreeItem`. |
| `src/views/worktreeNode.ts` | Verify label, icon, and context value mapping. |

### P3 — Low

| Module | Why |
|---|---|
| `src/git/gitExtensionApi.ts` | Thin bridge to `vscode.git`. Hard to unit-test meaningfully; prefer integration tests. |
| `src/extension.ts` | Activation lifecycle. Covered by smoke tests / VS Code extension tests. |

---

## 3. Test Framework

We use [Vitest](https://vitest.dev/) (v3.1+) for all unit tests.

### Running tests

```bash
# Full run with coverage report
npm test

# Watch mode during development
npm run test:watch

# Run a single test file
npx vitest run src/test/git/worktreeCore.test.ts
```

### Configuration

See [`vitest.config.ts`](../../vitest.config.ts) in the project root.

Key settings:
- `vscode` is externalized (provided by the VS Code runtime, not bundled).
- Coverage is provided by `@vitest/coverage-v8`.
- Coverage thresholds: **80 % line coverage** on `src/git/**`.
- Test file pattern: `src/**/*.test.ts`.

---

## 4. Mocking Strategy

### `child_process.execFile`

All three core functions (`addWorktree`, `removeWorktree`, `listWorktrees`) invoke `execFile` via `promisify`. Mock the entire `child_process` module at the top of the test file:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { execFile } from 'child_process';

vi.mock('child_process', () => ({
    execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);
```

Then configure the mock return value per test:

```typescript
beforeEach(() => {
    // promisify(execFile) calls execFile with a callback as the last argument.
    // When mocked, we simulate success by calling the callback.
    mockExecFile.mockImplementation(
        ((_cmd: string, _args: readonly string[], _opts: any, callback: Function) => {
            callback(null, { stdout: '<porcelain output>', stderr: '' });
        }) as any
    );
});
```

### `vscode` module

VS Code APIs are not available at test time. Create a manual mock:

```typescript
vi.mock('vscode', () => ({
    window: {
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showInputBox: vi.fn(),
        showQuickPick: vi.fn(),
    },
    commands: {
        executeCommand: vi.fn(),
    },
    Uri: {
        file: (path: string) => ({ fsPath: path, scheme: 'file' }),
    },
    TreeItem: class {},
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
    EventEmitter: class {
        event = vi.fn();
        fire = vi.fn();
    },
}));
```

> **Rule**: Never import the real `vscode` module in tests. Always mock it.

---

## 5. Coverage Targets

| Scope | Metric | Target |
|---|---|---|
| `src/git/**` | Line coverage | ≥ 80 % |
| `src/commands/**` | Line coverage | ≥ 70 % (stretch goal) |
| `src/views/**` | Line coverage | ≥ 60 % (stretch goal) |

The 80 % threshold on `src/git/**` is **enforced by CI** — the build will fail if coverage drops below that.

---

## 6. Test Naming Conventions

```typescript
describe('listWorktrees', () => {
    it('should return an empty array when stdout is empty', async () => {
        // ...
    });

    it('should parse a single worktree entry', async () => {
        // ...
    });
});
```

Rules:
- Top-level `describe` block = **function name** or **class name**.
- `it` blocks start with `should ...`.
- Group related assertions inside a single `it` when they test the same behaviour.
- Keep tests independent — each `it` must work in isolation. Use `beforeEach` for shared setup.

---

## 7. File Naming & Location

```
src/
  test/
    git/
      worktreeCore.test.ts      ← tests for src/git/worktreeCore.ts
      gitExtensionApi.test.ts   ← tests for src/git/gitExtensionApi.ts
    commands/
      addWorktree.test.ts       ← tests for src/commands/addWorktree.ts
      removeWorktree.test.ts
      switchWorktree.test.ts
    views/
      worktreeProvider.test.ts
      worktreeNode.test.ts
```

Mirror the `src/` directory structure inside `src/test/`.

---

## 8. Patterns for Testing VS Code Extension Commands

Command handlers typically follow this pattern:

```typescript
export async function addWorktreeCommand(gitAPI: GitAPI) {
    const branch = await vscode.window.showInputBox({ ... });
    if (!branch) return;
    await addWorktree(gitAPI.git.path, repo.rootUri.fsPath, branch, targetDir);
    vscode.window.showInformationMessage(`Worktree created for ${branch}`);
}
```

Test strategy:

1. Mock `vscode.window.showInputBox` to return a value (happy path) or `undefined` (cancel).
2. Mock the core function (`addWorktree`) to verify it was called with the correct arguments.
3. Assert the information/error message was shown.

```typescript
describe('addWorktreeCommand', () => {
    it('should call addWorktree and show success message', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValue('feature-x');
        const mockAddWorktree = vi.fn().mockResolvedValue(undefined);
        // ... invoke command
        expect(mockAddWorktree).toHaveBeenCalledWith('/usr/bin/git', '/repo', 'feature-x', expect.any(String));
        expect(vscode.window.showInformationMessage).toHaveBeenCalled();
    });

    it('should abort when user cancels input', async () => {
        vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
        // ... invoke command
        expect(mockAddWorktree).not.toHaveBeenCalled();
    });
});
```

---

## 9. Edge Cases to Always Consider

When writing tests for **any** worktree-related function, cover these scenarios:

| Scenario | Why it matters |
|---|---|
| **Empty repository** | `git worktree list` may return only the main worktree or unusual output |
| **Detached HEAD** | Worktree has no `branch` line — only `detached` |
| **Bare repository** | Worktree has `bare` instead of a branch |
| **Multi-repo workspace** | VS Code can have multiple repository roots; commands must operate on the correct one |
| **Path with spaces** | `worktree /path/to/my project` must not split on the space |
| **Windows paths** | `worktree C:\Users\dev\project` if cross-platform support is needed |
| **Missing git binary** | `execFile` throws `ENOENT` — command handlers should surface a user-friendly error |
| **Git command failure** | Non-zero exit code → stderr contains the error message |
| **No trailing newline** | Some git versions don't emit a trailing newline after the last entry |
| **Concurrent operations** | Two `addWorktree` calls at the same time (guard against race conditions) |

---

## 10. Adding Tests for New Features

When a new feature is added:

1. **Create a test file** mirroring the source file location (see Section 7).
2. **Write a `describe` block** for each new exported function.
3. **Cover the happy path first**, then add edge cases from Section 9.
4. **Verify coverage** with `npm test` — the CI threshold will catch regressions.
5. **Update this document** if new patterns or mocking strategies are introduced.

---

## 11. CI Integration

Tests run on every push and pull request via GitHub Actions. The workflow:

1. `npm ci`
2. `npm test` (runs `vitest run --coverage`)
3. Coverage report uploaded as artifact.

If the coverage threshold on `src/git/**` drops below 80 %, the build **fails**.
