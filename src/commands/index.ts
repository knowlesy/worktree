import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { addWorktreeCommand } from './addWorktree';
import { removeWorktreeCommand } from './removeWorktree';
import { switchWorktreeCommand } from './switchWorktree';
import { duplicateWorktreeCommand } from './duplicateWorktree';
import { WorktreeProvider } from '../views/worktreeProvider';
import { WorktreeNode } from '../views/worktreeNode';

export function registerCommands(context: vscode.ExtensionContext, gitApi: GitAPI, openRepositories: Set<string>, provider: WorktreeProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('git-worktrees.add', () => {
            addWorktreeCommand(gitApi, openRepositories).then(() => provider.refresh());
        }),
        vscode.commands.registerCommand('git-worktrees.remove', (node?: WorktreeNode) => {
            removeWorktreeCommand(gitApi, node).then(() => provider.refresh());
        }),
        vscode.commands.registerCommand('git-worktrees.duplicate', (node?: WorktreeNode) => {
            duplicateWorktreeCommand(gitApi, openRepositories, node).then(() => provider.refresh());
        }),
        vscode.commands.registerCommand('git-worktrees.switch', (node?: WorktreeNode) => {
            switchWorktreeCommand(node);
        }),
        vscode.commands.registerCommand('git-worktrees.refresh', () => {
            provider.refresh();
        })
    );
}
