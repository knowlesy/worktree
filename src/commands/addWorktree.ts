import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { addWorktree } from '../git/worktreeCore';

export async function addWorktreeCommand(gitApi: GitAPI, openRepositories: Set<string>) {
    if (openRepositories.size === 0) {
        vscode.window.showInformationMessage('No Git repositories found in the current workspace.');
        return;
    }

    let targetRepoPath: string | undefined;
    if (openRepositories.size === 1) {
        targetRepoPath = Array.from(openRepositories)[0];
    } else {
        const repoChoices = Array.from(openRepositories).map(repoPath => ({
            label: `$(repo) ${vscode.workspace.asRelativePath(repoPath)}`,
            description: repoPath,
            repoPath: repoPath
        }));
        
        const selected = await vscode.window.showQuickPick(repoChoices, {
            placeHolder: 'Select repository to add a worktree to'
        });
        if (!selected) return;
        targetRepoPath = selected.repoPath;
    }

    const branchName = await vscode.window.showInputBox({
        prompt: 'Enter the new branch/worktree name',
        placeHolder: 'feature/new-feature',
        validateInput: (value) => {
            if (!value) return 'Branch name cannot be empty';
            if (value.startsWith('-')) return 'Branch name cannot start with a hyphen';
            if (/\.\.|[\x00-\x20\x7F~^:?*\[\\]/.test(value)) return 'Branch name contains invalid characters';
            if (value.endsWith('/')) return 'Branch name cannot end with a slash';
            if (value.endsWith('.lock')) return 'Branch name cannot end with .lock';
            return null;
        }
    });
    if (!branchName) return;

    // sanitize for directory name
    const safeName = branchName.replace(/[\/\\]/g, '-').replace(/^\.+/, '').replace(/[^\w.-]/g, '');
    if (!safeName) {
        vscode.window.showErrorMessage('Invalid branch name provided.');
        return;
    }
    const worktreeDir = `../${safeName}`;

    try {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Adding Worktree ${branchName}...`,
            cancellable: false
        }, async () => {
            await addWorktree(gitApi.git.path, targetRepoPath!, branchName, worktreeDir);
        });
        
        vscode.window.showInformationMessage(`Successfully created worktree for ${branchName}.`);
        
        // Add it to the workspace
        const repoUri = vscode.Uri.file(targetRepoPath);
        const newUri = vscode.Uri.file(vscode.Uri.joinPath(repoUri, '..', safeName).fsPath);
        vscode.workspace.updateWorkspaceFolders(
            vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, 
            0, 
            { uri: newUri }
        );
        
    } catch (error: any) {
        vscode.window.showErrorMessage(`Failed to add worktree: ${error.message}`);
    }
}
