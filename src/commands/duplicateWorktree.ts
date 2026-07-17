import * as vscode from 'vscode';
import { GitAPI } from '../types';
import { WorktreeNode } from '../views/worktreeNode';
import { addWorktree, listWorktrees } from '../git/worktreeCore';

export async function duplicateWorktreeCommand(gitApi: GitAPI, openRepositories: Set<string>, node?: WorktreeNode) {
    if (!node) {
        vscode.window.showErrorMessage('Please right-click a worktree to duplicate it.');
        return;
    }

    if (!node.worktree.branch) {
        vscode.window.showErrorMessage('Cannot duplicate a detached or bare worktree. Select a valid branch.');
        return;
    }

    const branchName = node.worktree.branch.replace('refs/heads/', '');

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Finding eligible repositories for '${branchName}'...`,
        cancellable: false
    }, async () => {
        const repoChoices: vscode.QuickPickItem[] = [];

        for (const repoPath of openRepositories) {
            // Skip the repository that already owns the clicked worktree
            if (repoPath === node.repoPath) continue;

            try {
                const wts = await listWorktrees(gitApi.git.path, repoPath);
                const hasBranch = wts.some(wt => wt.branch === node.worktree.branch || wt.branch === branchName);
                const relativePath = vscode.workspace.asRelativePath(repoPath) || repoPath;
                
                if (hasBranch) {
                    repoChoices.push({
                        label: `$(check) ${relativePath}`,
                        description: 'Already has this branch',
                        detail: repoPath,
                        picked: false
                    });
                } else {
                    repoChoices.push({
                        label: `$(repo) ${relativePath}`,
                        description: 'Ready for duplication',
                        detail: repoPath,
                        picked: false
                    });
                }
            } catch (e) {
                // Ignore repos we can't read
            }
        }

        if (repoChoices.length === 0) {
            vscode.window.showInformationMessage(`No other repositories available.`);
            return;
        }

        const selected = await vscode.window.showQuickPick(repoChoices, {
            placeHolder: `Select repositories to duplicate '${branchName}' into`,
            canPickMany: true
        });

        if (!selected || selected.length === 0) return;

        // Filter out any repos that already had the branch in case they checked them anyway
        const targetRepoPaths = selected
            .filter(s => s.description === 'Ready for duplication')
            .map(s => s.detail as string);
            
        if (targetRepoPaths.length === 0) {
            vscode.window.showInformationMessage(`No new repositories selected for duplication.`);
            return;
        }
        const safeName = branchName.replace(/[\/\\]/g, '-').replace(/^\.+/, '').replace(/[^\w.-]/g, '');
        const worktreeDir = `../${safeName}`;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Duplicating '${branchName}' to ${targetRepoPaths.length} repos...`,
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
                    vscode.window.showInformationMessage(`Successfully duplicated '${branchName}' to ${successCount} repositor${successCount === 1 ? 'y' : 'ies'}.`);
                } else {
                    vscode.window.showWarningMessage(`Duplicated '${branchName}' to ${successCount} out of ${targetRepoPaths.length} selected repositories.`);
                }
            }
        });
    });
}
