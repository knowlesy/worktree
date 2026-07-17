# Security Reviewer — Agent Instructions

> **Scope:** Git Worktrees Native VS Code Extension  
> **Last updated:** 2026-07-17  
> **Codebase root:** `/Users/peterknowles/Repo/worktree`

---

## 1. Command Injection Audit

### 1.1 `execFile` vs `exec` — Baseline Safety

The project uses `child_process.execFile` (promisified as `execFileAsync`) to invoke git.
This is the **primary safe API** because `execFile` does **not** invoke a shell — arguments
are passed directly to the target binary as an `argv` array, which means classic shell
injection vectors (`; rm -rf /`, `$(cmd)`, `` `cmd` ``, pipes, redirects) are **not exploitable**.

**Verify this invariant holds everywhere:**

```bash
# Must return ONLY worktreeCore.ts, and must use execFile — never exec or spawn with shell:true
grep -rn "child_process" src/
grep -rn "exec(" src/           # should return 0 results
grep -rn "spawn(" src/          # should return 0 results
grep -rn "shell:" src/          # should return 0 results
```

### 1.2 Argument Injection via Git Flags

Even without a shell, **argument injection** is still possible. If user-supplied input
starts with `-` or `--`, git may interpret it as a flag rather than an operand.

#### Call Site 1 — `addWorktree()` in `src/git/worktreeCore.ts:7-11`

```typescript
// worktreeCore.ts:8
await execFileAsync(gitPath, ['worktree', 'add', '-b', branchName, worktreeDir], {
    cwd: repoPath
});
```

| Parameter     | Source                                                  | Risk |
|---------------|---------------------------------------------------------|------|
| `gitPath`     | `gitApi.git.path` — comes from VS Code's Git extension | Low (trusted) |
| `branchName`  | `vscode.window.showInputBox` — **raw user input**      | **High** |
| `worktreeDir` | `../${safeName}` — derived from sanitized user input    | Medium |
| `repoPath`    | `repo.rootUri.fsPath` — workspace state                 | Low (trusted) |

**Attack vector:** A `branchName` of `--exec=malicious-command` would cause git to
interpret it as a flag to `git worktree add`. Because `branchName` follows `-b`, git's
argument parser may or may not consume it as `-b`'s operand depending on the git version
and whether the value resembles a valid flag.

**Recommended fix — `--` separator:**

```typescript
await execFileAsync(gitPath, ['worktree', 'add', '--', '-b', branchName, worktreeDir], {
    cwd: repoPath
});
```

The `--` signals the end of options to git, so everything after it is treated as a
positional argument. However, note that the correct placement depends on the git
subcommand's parser. For `git worktree add`, the safest form is:

```typescript
await execFileAsync(gitPath, ['worktree', 'add', '-b', branchName, '--', worktreeDir], {
    cwd: repoPath
});
```

This ensures `branchName` is consumed as the value of `-b`, and `--` prevents
`worktreeDir` from being interpreted as a flag.

**Alternatively — input validation** (see Section 2).

#### Call Site 2 — `removeWorktree()` in `src/git/worktreeCore.ts:13-17`

```typescript
// worktreeCore.ts:14
await execFileAsync(gitPath, ['worktree', 'remove', worktreeDir], {
    cwd: repoPath
});
```

| Parameter     | Source                                                   | Risk |
|---------------|----------------------------------------------------------|------|
| `worktreeDir` | `node.worktree.path` — parsed from `git worktree list`  | Low–Medium |

The path originates from git's own output (the `--porcelain` listing parsed in
`listWorktrees`), so it is **not directly user-controlled** in the normal flow.
However, if git's output were somehow tampered with, or if the parsed path started
with `--`, it could be misinterpreted.

**Recommended fix:**

```typescript
await execFileAsync(gitPath, ['worktree', 'remove', '--', worktreeDir], {
    cwd: repoPath
});
```

#### Call Site 3 — `listWorktrees()` in `src/git/worktreeCore.ts:19-22`

```typescript
// worktreeCore.ts:20-22
const { stdout } = await execFileAsync(gitPath, ['worktree', 'list', '--porcelain'], {
    cwd: repoPath
});
```

All arguments are static literals — **no injection risk**.

### 1.3 `gitPath` Trust Boundary

`gitPath` comes from `gitApi.git.path`, which is resolved by VS Code's built-in Git
extension. This is a trusted source, but worth noting:

- If a malicious `.vscode/settings.json` overrides `git.path`, it could point to a
  trojan binary. This is a known VS Code trust-model issue (Workspace Trust) and is
  outside this extension's control.
- **Recommendation:** Do not allow this extension to override or supplement `git.path`.
  Always delegate to `vscode.git`.

---

## 2. Input Validation

### 2.1 Branch Name Validation

**Current state** (`src/commands/addWorktree.ts:28-35`):

```typescript
const branchName = await vscode.window.showInputBox({
    prompt: 'Enter the new branch/worktree name',
    placeHolder: 'feature/new-feature'
});
if (!branchName) return;

const safeName = branchName.replace(/[\/\\]/g, '-');
```

The only validation is an empty check (`if (!branchName) return`). The `safeName`
sanitization on line 35 only applies to the **directory name**, but the **raw
`branchName`** is passed to `execFileAsync` on line 44.

**Recommended validation — add a `validateBranchName` function:**

```typescript
function validateBranchName(name: string): string | null {
    // Reject names starting with '-' to prevent argument injection
    if (name.startsWith('-')) {
        return 'Branch name must not start with a dash (-)';
    }
    // Reject '..' sequences to prevent ref traversal
    if (name.includes('..')) {
        return 'Branch name must not contain ".."';
    }
    // Reject control characters (ASCII 0x00-0x1F, 0x7F)
    if (/[\x00-\x1f\x7f]/.test(name)) {
        return 'Branch name must not contain control characters';
    }
    // Reject git-unsafe characters per git-check-ref-format
    if (/[\s~^:?*\[\]\\]/.test(name)) {
        return 'Branch name contains invalid characters';
    }
    // Reject names ending with '.' or '.lock'
    if (name.endsWith('.') || name.endsWith('.lock')) {
        return 'Branch name must not end with "." or ".lock"';
    }
    // Reject '@{' sequence
    if (name.includes('@{')) {
        return 'Branch name must not contain "@{"';
    }
    return null; // valid
}
```

Use as the `validateInput` option in `showInputBox`:

```typescript
const branchName = await vscode.window.showInputBox({
    prompt: 'Enter the new branch/worktree name',
    placeHolder: 'feature/new-feature',
    validateInput: validateBranchName
});
```

**Recommended git ref regex** (matches `git check-ref-format` rules):

```regex
/^(?![-.])[a-zA-Z0-9\/_.-]+(?<![.\-])(?<!\.lock)$/
```

### 2.2 Path Traversal

**Current state** (`src/commands/addWorktree.ts:36`):

```typescript
const worktreeDir = `../${safeName}`;
```

This creates worktrees as siblings of the current repo. The relative `../${safeName}`
pattern is generally safe because:

1. `safeName` has `/` and `\` replaced with `-`, preventing deeper traversal.
2. `execFile` is called with `cwd: repoPath`, anchoring the relative path.

**Remaining risk:** If `safeName` is literally `..` (e.g., user enters `..`), the path
becomes `../../` — two levels up. The `/` and `\` replacement doesn't catch this because
`..` contains neither.

**Recommendation:** Also reject branch names that are exactly `.` or `..`, or that
resolve to a path outside the intended parent directory. Add to the validation function:

```typescript
if (name === '.' || name === '..') {
    return 'Branch name must not be "." or ".."';
}
```

### 2.3 Output Parsing Safety

`listWorktrees()` in `src/git/worktreeCore.ts:19-57` parses `git worktree list --porcelain`
output. The parser uses `startsWith` and `substring` — no regex, no `eval`. This is safe
but should be reviewed for:

- **Malformed output handling:** An unexpected line format silently falls through. This is
  acceptable but could benefit from a warning log.
- **Path injection via output:** A crafted worktree path in the porcelain output could
  contain special characters. Since the path is used in `vscode.Uri.file()` and displayed
  in the tree view, ensure no XSS-equivalent exists (VS Code's tree view API is generally
  safe from this, but verify tooltips).

---

## 3. Bundle & Memory Optimization

### 3.1 Bundle Analysis Methodology

Run the production build with esbuild's metafile and analyze flags:

```bash
# Add metafile to esbuild.js build options temporarily:
#   metafile: true,
# Then in the onEnd handler:
#   require('fs').writeFileSync('meta.json', JSON.stringify(result.metafile));
node esbuild.js --production

# Analyze the metafile:
npx esbuild --bundle --analyze < meta.json

# Or use the bundle visualizer:
npx esbuild-visualizer --metadata meta.json --open
```

**Current bundle facts:**
- Entry point: `src/extension.ts`
- Format: CJS
- External: `vscode` (correctly excluded)
- Minification: production only (`minify: production`)
- Source maps: dev only (`sourcemap: !production`)

### 3.2 Dependency Audit

Current `devDependencies` (no runtime `dependencies` — **good**):

| Package | Version | Purpose | Concern |
|---------|---------|---------|---------|
| `@types/node` | `18.x` | Type defs | Dev-only ✅ |
| `@types/vscode` | `^1.85.0` | Type defs | Dev-only ✅ |
| `esbuild` | `^0.19.11` | Bundler | Dev-only ✅ |
| `typescript` | `^5.3.3` | Compiler | Dev-only ✅ |

**No runtime dependencies** — the extension bundles everything via esbuild with `vscode`
as the sole external. This is the ideal pattern.

**Check:** Verify no transitive runtime dependencies sneak in:

```bash
# Should be empty or show only 'vscode':
node -e "const m = require('./dist/extension.js'); console.log('loaded')"
```

### 3.3 Tree-Shaking Verification

esbuild performs tree-shaking by default in bundle mode. Verify effectiveness:

1. Check the metafile for unexpected modules.
2. Confirm `child_process` and `util` are NOT bundled (they're Node.js built-ins and
   should be resolved at runtime). If they appear in the bundle, add them to `external`.

**Recommendation:** Add Node.js built-ins to `external` explicitly in `esbuild.js`:

```javascript
external: ['vscode', 'child_process', 'util'],
```

Or use a plugin like `@esbuild-plugins/node-externals`.

### 3.4 Source Map & Sensitive File Leakage

**Current `.vscodeignore`:**

```
.vscode/**
.vscode-test/**
src/**
.gitignore
.github/**
tsconfig.json
esbuild.js
**/*.map
**/*.ts
node_modules/**
```

**Assessment:**

| Item | Status |
|------|--------|
| Source maps (`*.map`) | ✅ Excluded |
| TypeScript source (`*.ts`, `src/**`) | ✅ Excluded |
| `node_modules/` | ✅ Excluded |
| `.agents/` | ⚠️ **NOT excluded** — security docs would ship in VSIX |
| `vitest.config.ts` | ⚠️ Matched by `**/*.ts` but also explicitly worth listing |
| `package-lock.json` | ⚠️ **NOT excluded** — exposes dependency tree |
| `dist/*.js.map` | ✅ Matched by `**/*.map` |
| `.github/` | ✅ Excluded |
| `src/test/` | ✅ Covered by `src/**` |

**Recommended additions to `.vscodeignore`:**

```
.agents/**
package-lock.json
vitest.config.ts
```

---

## 4. Hardening Patterns

### 4.1 Content Security Policy (Webviews)

The extension currently does **not** use webviews. If webviews are added in the future:

```typescript
const panel = vscode.window.createWebviewPanel(
    'worktreeDetail', 'Worktree', vscode.ViewColumn.One,
    {
        enableScripts: false,  // Default — keep disabled unless needed
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
);
```

If scripts must be enabled, use a nonce-based CSP:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'none';
               style-src ${webview.cspSource};
               script-src 'nonce-${nonce}';">
```

### 4.2 Principle of Least Privilege — VS Code API Permissions

**Current `package.json` review:**

| Field | Value | Assessment |
|-------|-------|------------|
| `activationEvents` | `[]` (empty) | ✅ Activates only when commands/views are used |
| `extensionDependencies` | `["vscode.git"]` | ✅ Minimal — only depends on built-in git |
| `engines.vscode` | `^1.85.0` | ✅ Reasonable minimum |
| API capabilities used | `workspace.workspaceFolders`, `window.showInputBox`, `commands.executeCommand` | ✅ All standard, no elevated capabilities |

**No file system access outside of workspace folders** — The extension does not use
`fs` directly; all file operations go through git or VS Code workspace APIs. ✅

**No network access** — The extension makes no HTTP requests. ✅

**No secrets or authentication** — The extension does not use `SecretStorage` or
any authentication APIs. ✅

### 4.3 Error Message Information Leakage

Review all `catch` blocks for information disclosure:

| Location | Error Handling | Risk |
|----------|---------------|------|
| `addWorktree.ts:58-60` | `` `Failed to add worktree: ${error.message}` `` | Medium — `error.message` from `execFile` may contain full command line, paths, or git internal errors |
| `removeWorktree.ts:42-44` | `` `Failed to remove worktree: ${error.message}` `` | Medium — same risk |
| `worktreeProvider.ts:49-51` | `console.error(...)` | Low — console only, not shown to user |
| `extension.ts` | No try/catch around activation | Low — VS Code handles activation errors |

**Recommendation:** Sanitize error messages before displaying to the user. Replace
raw `error.message` with a generic message and log the full error to the output channel:

```typescript
const outputChannel = vscode.window.createOutputChannel('Git Worktrees');

// In catch blocks:
outputChannel.appendLine(`Error: ${error.message}\n${error.stack}`);
vscode.window.showErrorMessage('Failed to add worktree. Check "Git Worktrees" output for details.');
```

### 4.4 Prototype Pollution & Supply Chain

- **No `JSON.parse` of untrusted input** — The only parsing is of git's porcelain output
  via string splitting. ✅
- **No `eval`, `Function()`, or dynamic imports** — Verified by grep. ✅
- **No runtime dependencies** — Supply chain attack surface is limited to dev
  dependencies (esbuild, typescript). ✅

---

## 5. Audit Execution Checklist

After completing a review, the security reviewer should:

1. Run the audit checklist at `.agents/security-reviewer/audit-checklist.md`
2. Run the security ESLint config: `npx eslint --config .agents/security-reviewer/.eslintrc.security.json src/`
3. Verify all `execFileAsync` call sites use `--` separator
4. Verify input validation is applied to all user-facing inputs
5. Run `vsce ls` to inspect what would be packaged in the VSIX
6. Review the bundle output with `node esbuild.js --production && ls -la dist/`

---

## 6. References

- [Node.js `child_process.execFile` docs](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback)
- [git-check-ref-format(1)](https://git-scm.com/docs/git-check-ref-format)
- [VS Code Extension Security](https://code.visualstudio.com/api/extension-guides/web-extensions#security)
- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [VS Code Workspace Trust](https://code.visualstudio.com/docs/editor/workspace-trust)
