import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { addWorktree, listWorktrees } from '../git/worktreeCore';

export async function addWorktreeCommand(gitApi: GitAPI, openRepositories: Set<string>) {
    if (openRepositories.size === 0) {
        vscode.window.showInformationMessage('No Git repositories found in the current workspace.');
        return;
    }

    let targetRepoPaths: string[] = [];
    if (openRepositories.size === 1) {
        targetRepoPaths = [Array.from(openRepositories)[0]];
    } else {
        const repoChoices = Array.from(openRepositories).map(repoPath => ({
            label: `$(repo) ${vscode.workspace.asRelativePath(repoPath)}`,
            description: repoPath,
            repoPath: repoPath
        }));
        
        const selected = await vscode.window.showQuickPick(repoChoices, {
            placeHolder: 'Select repositories to add a worktree to',
            canPickMany: true
        });
        if (!selected || selected.length === 0) return;
        targetRepoPaths = selected.map(s => s.repoPath);
    }

    // Gather existing branches across all open repos
    const existingBranches = new Set<string>();
    for (const repoPath of openRepositories) {
        try {
            const wts = await listWorktrees(gitApi.git.path, repoPath);
            for (const wt of wts) {
                if (wt.branch) existingBranches.add(wt.branch);
            }
        } catch (e) {
            // Ignore if we can't read worktrees for a repo
        }
    }

    const branchChoices: vscode.QuickPickItem[] = [
        { label: '$(plus) Create new branch...', alwaysShow: true }
    ];
    
    for (const b of existingBranches) {
        branchChoices.push({
            label: `$(git-branch) ${b}`,
            description: 'Existing branch in workspace'
        });
    }

    const branchSelection = await vscode.window.showQuickPick(branchChoices, {
        placeHolder: 'Select an existing workspace branch, or create a new one'
    });
    
    if (!branchSelection) return;

    let branchName = '';
    if (branchSelection.label === '$(plus) Create new branch...') {
        const input = await vscode.window.showInputBox({
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
        if (!input) return;
        branchName = input;
    } else {
        branchName = branchSelection.label.replace('$(git-branch) ', '');
    }

    const safeName = branchName.replace(/[\/\\]/g, '-').replace(/^\.+/, '').replace(/[^\w.-]/g, '');
    if (!safeName) {
        vscode.window.showErrorMessage('Invalid branch name provided.');
        return;
    }
    const worktreeDir = `../${safeName}`;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: targetRepoPaths.length > 1 ? `Adding Worktree ${branchName} to ${targetRepoPaths.length} repositories...` : `Adding Worktree ${branchName}...`,
        cancellable: false
    }, async () => {
        const newUris: vscode.Uri[] = [];
        let successCount = 0;
        
        for (const repoPath of targetRepoPaths) {
            try {
                await addWorktree(gitApi.git.path, repoPath, branchName, worktreeDir);
                const repoUri = vscode.Uri.file(repoPath);
                newUris.push(vscode.Uri.file(vscode.Uri.joinPath(repoUri, '..', safeName).fsPath));
                successCount++;
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed in ${vscode.workspace.asRelativePath(repoPath)}: ${error.message}`);
            }
        }
        
        if (newUris.length > 0) {
            const start = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0;
            const workspaceFoldersToAdd = newUris.map(uri => ({ uri }));
            vscode.workspace.updateWorkspaceFolders(start, 0, ...workspaceFoldersToAdd);
            
            if (successCount === targetRepoPaths.length) {
                vscode.window.showInformationMessage(`Successfully added worktree for ${branchName} to ${successCount} repositor${successCount === 1 ? 'y' : 'ies'}.`);
            } else {
                vscode.window.showWarningMessage(`Added worktree for ${branchName} to ${successCount} out of ${targetRepoPaths.length} selected repositories.`);
            }
        }
    });
}
