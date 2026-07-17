# Git Worktrees Native

<p align="center">
  <img src="icon.jpg" width="128" alt="Git Worktrees Native Logo">
</p>

<p align="center">
  <strong>Native, lightning-fast Git worktree management for multi-repo workspaces.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=knowlesy.git-worktrees-native"><img src="https://img.shields.io/vs-marketplace/v/knowlesy.git-worktrees-native" alt="Marketplace Version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=knowlesy.git-worktrees-native"><img src="https://img.shields.io/vs-marketplace/i/knowlesy.git-worktrees-native" alt="Installs"></a>
  <a href="https://github.com/knowlesy/worktree/actions"><img src="https://github.com/knowlesy/worktree/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
  <a href="https://github.com/knowlesy/worktree/blob/main/LICENSE"><img src="https://img.shields.io/github/license/knowlesy/worktree" alt="License"></a>
</p>

## Features

- **Lightning Fast**: Built directly on top of the native VS Code Git Extension API and `git worktree` commands.
- **Multi-Repo Support**: Automatically detects and lists worktrees across all open repositories in your workspace.
- **Easy Management**: Add, remove, and switch between worktrees directly from the Source Control (SCM) view.
- **Visual Indicators**: Clear icons distinguishing between bare repositories, detached heads, and active branches.

## Usage

You can access Git Worktrees Native through the **Source Control (SCM)** view in the sidebar, or via the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).

### Available Commands
- `Git Worktrees: Add Worktree` - Creates a new worktree and branch.
- `Git Worktrees: Remove Worktree` - Removes an existing worktree safely.
- `Git Worktrees: Switch Worktree` - Opens the selected worktree folder in the current or a new window.
- `Git Worktrees: Refresh` - Manually refreshes the worktrees list.

## Requirements

- VS Code `^1.85.0`
- Git installed and available in your system's `PATH`.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to build, test, and submit pull requests.

## License

This project is licensed under the [MIT License](LICENSE).
