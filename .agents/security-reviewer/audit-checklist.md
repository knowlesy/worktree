# Security Audit Checklist — Git Worktrees Native

> **Extension:** `git-worktrees-native` v1.0.0  
> **Auditor:** @Security-Reviewer  
> **Date:** ___________  
> **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

## 🔴 Critical — Command Execution

- [ ] **ARG-INJECT-001:** Review `execFileAsync` call in [worktreeCore.ts:8](file:///Users/peterknowles/Repo/worktree/src/git/worktreeCore.ts#L8) — `branchName` passed as argument to `git worktree add -b`. User-supplied value from `showInputBox` reaches `execFile` without validation. A branch name like `--exec=cmd` could be interpreted as a git flag.
- [ ] **ARG-INJECT-002:** Review `execFileAsync` call in [worktreeCore.ts:14](file:///Users/peterknowles/Repo/worktree/src/git/worktreeCore.ts#L14) — `worktreeDir` passed as argument to `git worktree remove`. Value originates from `git worktree list` output parsing; lower risk but should use `--` separator.
- [ ] **EXEC-SAFE-001:** Confirm `execFile` (not `exec`) is used in all call sites — run `grep -rn "child_process" src/` and verify no `exec(`, `spawn(` with `shell: true`, or `execSync` calls exist.
- [ ] **EXEC-SAFE-002:** Verify `shell: true` is never passed as an option to any `execFile`/`execFileAsync` call in [worktreeCore.ts](file:///Users/peterknowles/Repo/worktree/src/git/worktreeCore.ts).
- [ ] **DD-SEP-001:** Verify `--` (double-dash) separator is used before user-supplied positional arguments in all `execFileAsync` invocations to prevent argument injection.

---

## 🟠 High — Input Validation

- [ ] **INPUT-001:** Validate branch name input in [addWorktree.ts:28-32](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L28-L32) — currently only checks for empty string (`if (!branchName) return`). No validation for names starting with `-`, containing `..`, control characters, or git-invalid ref characters (`~`, `^`, `:`, `?`, `*`, `[`, `]`, `\`, spaces).
- [ ] **INPUT-002:** Add `validateInput` callback to `showInputBox` in [addWorktree.ts:28-31](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L28-L31) that enforces `git check-ref-format` rules.
- [ ] **PATH-001:** Review path construction in [addWorktree.ts:36](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L36) — `../${safeName}` relative path. Confirm that a `safeName` of `..` (from branch name `..`) cannot escape the intended parent directory to create worktrees two levels up.
- [ ] **PATH-002:** Verify that `safeName` sanitization in [addWorktree.ts:35](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L35) (`branchName.replace(/[\/\\]/g, '-')`) is sufficient — it does NOT strip `.`, `..`, or names that could conflict with system directories.
- [ ] **GITPATH-001:** Verify `gitApi.git.path` is sourced exclusively from VS Code's built-in git extension and is not overridable by this extension's configuration. Review [gitExtensionApi.ts:4-18](file:///Users/peterknowles/Repo/worktree/src/git/gitExtensionApi.ts#L4-L18).

---

## 🟡 Medium — Defense in Depth

- [ ] **SANITIZE-001:** Review sanitization regex in [addWorktree.ts:35](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L35) — `/[\/\\]/g` only replaces forward and back slashes. Does not address: names starting with `-`, `..` sequences, control characters, or whitespace.
- [ ] **ERRINFO-001:** Check error messages for information leakage in [addWorktree.ts:59](file:///Users/peterknowles/Repo/worktree/src/commands/addWorktree.ts#L59) — `error.message` from `execFile` failure may expose full command line, filesystem paths, or git internal state to the user.
- [ ] **ERRINFO-002:** Check error messages for information leakage in [removeWorktree.ts:43](file:///Users/peterknowles/Repo/worktree/src/commands/removeWorktree.ts#L43) — same risk as ERRINFO-001.
- [ ] **ERRINFO-003:** Review `console.error` in [worktreeProvider.ts:50](file:///Users/peterknowles/Repo/worktree/src/views/worktreeProvider.ts#L50) — logs full error to debug console. Lower risk since not shown in UI, but could leak info if console output is captured.
- [ ] **VSIX-001:** Verify `.vscodeignore` excludes all sensitive/unnecessary files. Current file at [.vscodeignore](file:///Users/peterknowles/Repo/worktree/.vscodeignore) is **missing** entries for: `.agents/**`, `package-lock.json`, `vitest.config.ts`.
- [ ] **PARSE-001:** Review `listWorktrees` output parsing in [worktreeCore.ts:24-56](file:///Users/peterknowles/Repo/worktree/src/git/worktreeCore.ts#L24-L56) — verify that malformed or adversarial `git worktree list --porcelain` output does not cause crashes, prototype pollution, or unexpected state.
- [ ] **TOOLTIP-001:** Review tooltip content in [worktreeNode.ts:27](file:///Users/peterknowles/Repo/worktree/src/views/worktreeNode.ts#L27) — worktree path and commit hash displayed in tooltip. Verify VS Code's TreeItem tooltip rendering sanitizes content (it does, but confirm for the VS Code version range `^1.85.0`).
- [ ] **URI-001:** Review `vscode.commands.executeCommand('vscode.openFolder', uri, false)` in [switchWorktree.ts:20](file:///Users/peterknowles/Repo/worktree/src/commands/switchWorktree.ts#L20) — `uri` is derived from `node.worktree.path`. Verify that a crafted path cannot open arbitrary locations or trigger unintended behavior.

---

## 🟢 Low — Build, Bundle & Configuration

- [ ] **BUNDLE-001:** Run production bundle analysis — `node esbuild.js --production` with metafile enabled. Verify bundle size is reasonable (current: ~11.8 KB) and no unnecessary code is included.
- [ ] **BUNDLE-002:** Verify `sourcemap: !production` in [esbuild.js:29](file:///Users/peterknowles/Repo/worktree/esbuild.js#L29) ensures no source maps ship in the production VSIX.
- [ ] **BUNDLE-003:** Verify `sourcesContent: false` in [esbuild.js:30](file:///Users/peterknowles/Repo/worktree/esbuild.js#L30) ensures original source content is never embedded in source maps.
- [ ] **DEPS-001:** Check for unused dependencies in [package.json](file:///Users/peterknowles/Repo/worktree/package.json) — currently all dependencies are `devDependencies` (✅ good). Confirm no `dependencies` section is added.
- [ ] **DEPS-002:** Verify no runtime `dependencies` (only `devDependencies`) exist in [package.json:85-90](file:///Users/peterknowles/Repo/worktree/package.json#L85-L90).
- [ ] **PERM-001:** Review VS Code extension permissions — `activationEvents` is `[]` (empty array) in [package.json:18](file:///Users/peterknowles/Repo/worktree/package.json#L18). Verify extension activates only on-demand via commands/views, not wildcard `*`.
- [ ] **PERM-002:** Review `extensionDependencies` — currently `["vscode.git"]` in [package.json:14-16](file:///Users/peterknowles/Repo/worktree/package.json#L14-L16). Verify no unnecessary extension dependencies.
- [ ] **EXTERN-001:** Verify `external: ['vscode']` in [esbuild.js:33](file:///Users/peterknowles/Repo/worktree/esbuild.js#L33). Consider also externalizing Node.js built-ins (`child_process`, `util`) to prevent bundling issues.
- [ ] **TREESHAKE-001:** Verify esbuild tree-shaking is working — no dead code paths or unused exports are included in the production bundle.
- [ ] **NOEVAL-001:** Confirm no `eval()`, `new Function()`, or `import()` with dynamic strings exists anywhere in `src/` — run `grep -rn "eval\|new Function\|import(" src/`.
- [ ] **NOSECRETS-001:** Confirm no hardcoded secrets, API keys, or tokens exist in the codebase — run `grep -rn "password\|secret\|token\|api_key\|apiKey" src/`.

---

## 📋 Post-Audit Actions

After completing the checklist:

1. [ ] Run security ESLint config: `npx eslint --config .agents/security-reviewer/.eslintrc.security.json src/`
2. [ ] Run `vsce ls` to inspect packaged files and verify no sensitive files are included
3. [ ] File issues for any unchecked Critical or High items
4. [ ] Update this checklist with findings and mark items as complete
5. [ ] Sign off:

**Auditor:** ___________  
**Date:** ___________  
**Result:** ☐ Pass | ☐ Pass with conditions | ☐ Fail
