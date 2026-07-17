# DevOps Agent — CI/CD Pipeline Instructions

## Overview

This document describes the CI/CD infrastructure for the **git-worktrees-native** VS Code extension. It covers continuous integration, release automation, version management, and Marketplace publishing.

---

## 1. CI Pipeline Design

### Triggers

- **Push** to `main` or `master` branches
- **Pull requests** targeting `main` or `master`

### Matrix Strategy

Run the build across multiple Node.js versions to ensure compatibility:

| Node Version | Purpose                        |
|--------------|--------------------------------|
| 18.x         | LTS baseline compatibility     |
| 20.x         | Current LTS, primary target    |

### Pipeline Steps

```text
checkout → install → type-check → test → build → upload VSIX artifact
```

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node** — `actions/setup-node@v4` with npm cache enabled
3. **Install** — `npm ci` (clean install from lockfile)
4. **Type-check** — `npx tsc --noEmit` (catches type errors without emitting files)
5. **Test** — `npm test` (runs vitest suite)
6. **Build** — `npm run package` (production esbuild bundle)
7. **Upload VSIX** — `actions/upload-artifact@v4` (only on Node 20.x to avoid duplicate artifacts)

### Caching

npm's global cache is automatically handled by `actions/setup-node@v4` when `cache: 'npm'` is set. This speeds up `npm ci` by avoiding re-downloads.

### Concurrency

Use a concurrency group keyed on `ci-${{ github.ref }}` with `cancel-in-progress: true` to automatically cancel stale runs when a new push arrives on the same branch.

### Status Checks

> [!IMPORTANT]
> Configure branch protection rules on `main`/`master` to **require the CI workflow to pass** before merging pull requests.

In GitHub repo settings → Branches → Branch protection rules:
- Enable "Require status checks to pass before merging"
- Select the `build-and-test` job as a required check

---

## 2. Release Pipeline Design

### Triggers

- **Tag push** matching `v*` (e.g., `v1.0.0`, `v1.2.3`)
- **Manual** via `workflow_dispatch` (for re-running a failed release)

### Pipeline Steps

```text
checkout → install → test → build → package VSIX → create GitHub Release → publish to Marketplace
```

1. **Checkout** — `actions/checkout@v4`
2. **Setup Node 20.x** — `actions/setup-node@v4` with npm cache
3. **Install** — `npm ci`
4. **Test** — `npm test`
5. **Build** — `npm run package`
6. **Package VSIX** — `npx @vscode/vsce package --out ./git-worktrees-native.vsix`
7. **Create GitHub Release** — `softprops/action-gh-release@v2` with the `.vsix` file as a release asset and auto-generated release notes
8. **Publish to Marketplace** — `npx @vscode/vsce publish --pat ${{ secrets.VSCE_PAT }}`

### Why `@vscode/vsce` CLI?

> [!TIP]
> Use the official `@vscode/vsce` CLI directly instead of third-party GitHub Actions. It is maintained by Microsoft, always up to date with Marketplace requirements, and gives you full control over packaging and publishing.

### Secrets Required

| Secret Name | Description                                      |
|-------------|--------------------------------------------------|
| `VSCE_PAT`  | VS Code Marketplace Personal Access Token (PAT)  |

#### How to Create the `VSCE_PAT`

1. Go to [Azure DevOps](https://dev.azure.com/) and sign in with the Microsoft account that owns your Marketplace publisher
2. Click your profile icon → **Personal access tokens**
3. Click **+ New Token**
4. Configure:
   - **Name**: `vsce-publish` (or any descriptive name)
   - **Organization**: Select `All accessible organizations`
   - **Expiration**: Set to maximum (1 year), and set a calendar reminder to rotate
   - **Scopes**: Click "Show all scopes", then check **Marketplace → Manage**
5. Click **Create** and **copy the token immediately** (it won't be shown again)

#### How to Add the Secret to GitHub

1. Go to your repository on GitHub
2. Navigate to **Settings → Secrets and variables → Actions**
3. Click **New repository secret**
4. Name: `VSCE_PAT`, Value: paste the token from above
5. Click **Add secret**

### Permissions

The release workflow needs `contents: write` permission to create GitHub Releases.

---

## 3. Version Management

### Semantic Versioning

Follow [Semantic Versioning 2.0.0](https://semver.org/):

| Change Type       | Version Bump | Example         |
|--------------------|-------------|-----------------|
| Breaking changes   | MAJOR       | `1.0.0 → 2.0.0` |
| New features       | MINOR       | `1.0.0 → 1.1.0` |
| Bug fixes          | PATCH       | `1.0.0 → 1.0.1` |

### Release Workflow

The recommended release process:

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Bump version (choose one)
npm version patch   # 1.0.0 → 1.0.1
npm version minor   # 1.0.0 → 1.1.0
npm version major   # 1.0.0 → 2.0.0

# 3. Push the commit and tag
git push origin main --follow-tags
```

> [!NOTE]
> `npm version` automatically:
> - Updates `version` in `package.json`
> - Creates a git commit with the message `v{version}`
> - Creates a git tag `v{version}`

The tag push triggers the Release workflow, which handles everything else automatically.

### Alternative: Manual Version Bump

If you prefer manual control:

```bash
# 1. Edit version in package.json manually
# 2. Commit the change
git add package.json
git commit -m "chore: bump version to 1.2.3"

# 3. Create and push the tag
git tag v1.2.3
git push origin main --follow-tags
```

---

## 4. Marketplace Publishing

### Publisher Setup

1. Go to [Visual Studio Marketplace Management](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account
3. Create a new publisher if you don't have one:
   - Choose a **Publisher ID** (e.g., `your-org-name`)
   - This ID is permanent and public
4. Update `package.json`:
   ```json
   {
     "publisher": "your-actual-publisher-id"
   }
   ```

> [!WARNING]
> The `publisher` field in `package.json` **must exactly match** your Marketplace publisher ID. A mismatch will cause publishing to fail. The current placeholder `your-publisher-name` must be replaced before the first release.

### VSIX Validation

Before publishing, `vsce` validates the VSIX package. Common validation failures:

- Missing `README.md`
- Missing `LICENSE` or `LICENSE.md`
- Missing `repository` field in `package.json`
- Icon file referenced but not found
- `engines.vscode` version mismatch

### Pre-Publish Checklist

Before your first (or any major) release, verify:

- [ ] `publisher` in `package.json` matches your Marketplace publisher ID
- [ ] `README.md` exists and describes the extension clearly
- [ ] `CHANGELOG.md` exists and documents changes for this version
- [ ] `LICENSE` or `LICENSE.md` exists
- [ ] `icon` field in `package.json` points to a valid 128×128 PNG image
- [ ] `repository` field in `package.json` points to the GitHub repo
- [ ] `engines.vscode` specifies the minimum supported VS Code version
- [ ] `.vscodeignore` excludes unnecessary files from the VSIX
- [ ] Version in `package.json` has been bumped appropriately
- [ ] All tests pass locally (`npm test`)
- [ ] Extension packages successfully (`npx @vscode/vsce package`)

### Testing the VSIX Locally

Before publishing, you can install the VSIX locally to verify:

```bash
# Package the extension
npx @vscode/vsce package --out ./git-worktrees-native.vsix

# Install in VS Code
code --install-extension ./git-worktrees-native.vsix
```

---

## 5. Workflow File Locations

The workflow files are staged in `.agents/devops/` for review:

| File                          | Purpose                        |
|-------------------------------|--------------------------------|
| `.agents/devops/ci.yml`       | CI workflow (build + test)     |
| `.agents/devops/release.yml`  | Release workflow (tag → publish)|

When ready to activate, copy them to `.github/workflows/`:

```bash
cp .agents/devops/ci.yml .github/workflows/ci.yml
cp .agents/devops/release.yml .github/workflows/release.yml
```

> [!CAUTION]
> The existing `.github/workflows/publish.yml` should be reviewed and potentially removed once the new `release.yml` is active, to avoid duplicate publishing attempts on tag pushes.

---

## 6. Troubleshooting

### CI Failures

| Symptom                          | Likely Cause                          | Fix                                    |
|----------------------------------|---------------------------------------|----------------------------------------|
| `npm ci` fails                   | Missing or outdated `package-lock.json` | Run `npm install` and commit the lockfile |
| `tsc --noEmit` fails             | TypeScript type errors                | Fix type errors in source code         |
| `npm test` fails                 | Failing tests                         | Fix tests or update snapshots          |
| `npm run package` fails          | esbuild configuration issue           | Check `esbuild.js` and entry points    |
| VSIX upload fails                | Artifact path mismatch                | Verify the glob pattern in the workflow |

### Release Failures

| Symptom                          | Likely Cause                          | Fix                                    |
|----------------------------------|---------------------------------------|----------------------------------------|
| `vsce package` fails             | Validation error (missing files)      | Check the pre-publish checklist above  |
| `vsce publish` fails with 401    | Invalid or expired PAT                | Rotate the PAT and update the secret   |
| `vsce publish` fails with 409    | Version already exists on Marketplace | Bump the version and re-tag            |
| GitHub Release not created       | Missing `contents: write` permission  | Check workflow permissions             |
