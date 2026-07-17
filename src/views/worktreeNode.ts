import * as vscode from 'vscode';
import { WorktreeInfo } from '../types';

export class RepositoryNode extends vscode.TreeItem {
    constructor(
        public readonly repoPath: string,
        public readonly label: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = new vscode.ThemeIcon('repo');
        this.contextValue = 'repository';
    }
}

export class WorktreeNode extends vscode.TreeItem {
    constructor(
        public readonly repoPath: string,
        public readonly worktree: WorktreeInfo
    ) {
        let label = worktree.branch ? worktree.branch.replace('refs/heads/', '') : 'detached';
        if (worktree.isBare) {
            label = 'bare';
        }
        super(label, vscode.TreeItemCollapsibleState.None);

        this.description = vscode.workspace.asRelativePath(worktree.path, false);
        this.tooltip = `Path: ${worktree.path}\nCommit: ${worktree.commit}`;
        this.iconPath = new vscode.ThemeIcon(worktree.isBare ? 'file-directory' : 'git-branch');
        this.contextValue = 'worktree';
    }
}

export type WorktreeTreeNode = RepositoryNode | WorktreeNode;
