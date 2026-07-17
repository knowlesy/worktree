import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { removeWorktree } from '../git/worktreeCore';
import { WorktreeNode } from '../views/worktreeNode';

export async function removeWorktreeCommand(gitApi: GitAPI, node?: WorktreeNode) {
    if (!node) {
        vscode.window.showErrorMessage('Please select a worktree from the view to remove.');
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to remove the worktree '${node.worktree.path}'? This cannot be undone.`,
        { modal: true },
        'Remove'
    );

    if (confirm !== 'Remove') {
        return;
    }

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Removing Worktree...`,
            cancellable: false
        }, async () => {
            await removeWorktree(gitApi.git.path, node.repoPath, node.worktree.path);
        });
        
        vscode.window.showInformationMessage(`Successfully removed worktree.`);
        
        // Remove from workspace if it's currently open
        const folders = vscode.workspace.workspaceFolders;
        if (folders) {
            const index = folders.findIndex(f => f.uri.fsPath === node.worktree.path);
            if (index !== -1) {
                vscode.workspace.updateWorkspaceFolders(index, 1);
            }
        }
        
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to remove worktree: ${error.message}`);
    }
}
