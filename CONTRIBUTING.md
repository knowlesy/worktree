# Contributing to Git Worktrees Native

First off, thank you for considering contributing! It's people like you that make open-source software great.

## Development Setup

1. Fork and clone the repository.
2. Run `npm install` to install dependencies.
3. Open the repository in VS Code.
4. Press `F5` to start debugging. This will automatically run the `npm run watch` task and launch an Extension Development Host window.

## Submitting Pull Requests

1. **Create a branch** for your feature or bug fix.
2. **Write tests** if you are adding new logic (`src/test/git/worktreeCore.test.ts`).
3. **Run tests** locally using `npm test` and `npm run test:integration`.
4. **Lint your code** to ensure security standards are met: `npx eslint --config .agents/security-reviewer/.eslintrc.security.json src/`.
5. **Open a Pull Request** using the provided template and wait for review!

## Code Style
- Use 4 spaces for indentation in TypeScript files (enforced via `.editorconfig`).
- Avoid `exec` or `shell: true` when dealing with `child_process`. Always use `execFile` with the `--` separator for safety against argument injection.
