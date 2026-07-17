import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { RepositoryNode, WorktreeNode, WorktreeTreeNode } from './worktreeNode';
import { listWorktrees } from '../git/worktreeCore';

export class WorktreeProvider implements vscode.TreeDataProvider<WorktreeTreeNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<WorktreeTreeNode | undefined | void> = new vscode.EventEmitter<WorktreeTreeNode | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<WorktreeTreeNode | undefined | void> = this._onDidChangeTreeData.event;

    constructor(
        private gitApi: GitAPI,
        private openRepositories: Set<string>
    ) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WorktreeTreeNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WorktreeTreeNode): Promise<WorktreeTreeNode[]> {
        if (!element) {
            // Root level: Return repositories if there's more than one, else skip right to worktrees
            if (this.openRepositories.size === 0) {
                return [];
            }
            if (this.openRepositories.size === 1) {
                const repoPath = Array.from(this.openRepositories)[0];
                return this.getWorktreesForRepo(repoPath);
            }
            // Multiple repos
            return Array.from(this.openRepositories).map(repoPath => {
                const label = vscode.workspace.asRelativePath(repoPath);
                return new RepositoryNode(repoPath, label || repoPath);
            });
        } else if (element instanceof RepositoryNode) {
            return this.getWorktreesForRepo(element.repoPath);
        }
        return [];
    }

    private async getWorktreesForRepo(repoPath: string): Promise<WorktreeNode[]> {
        try {
            const gitPath = this.gitApi.git.path;
            const worktrees = await listWorktrees(gitPath, repoPath);
            return worktrees.map(wt => new WorktreeNode(repoPath, wt));
        } catch (error) {
            console.error(`Failed to get worktrees for ${repoPath}`, error);
            return [];
        }
    }
}
