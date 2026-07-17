import * as vscode from 'vscode';
import { getGitApi } from './git/gitExtensionApi';
import { WorktreeProvider } from './views/worktreeProvider';
import { registerCommands } from './commands';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Git Worktrees extension is activating...');

    const gitApi = getGitApi();
    if (!gitApi) return;

    const openRepositories = new Set<string>();
    
    // Add already open repositories
    gitApi.repositories.forEach((repo: any) => {
        openRepositories.add(repo.rootUri.fsPath);
    });

    const provider = new WorktreeProvider(gitApi, openRepositories);
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('gitWorktreesView', provider)
    );

    // Listen to repository state changes
    context.subscriptions.push(
        gitApi.onDidOpenRepository((repo: any) => {
            openRepositories.add(repo.rootUri.fsPath);
            provider.refresh();
        }),
        gitApi.onDidCloseRepository((repo: any) => {
            openRepositories.delete(repo.rootUri.fsPath);
            provider.refresh();
        })
    );

    registerCommands(context, gitApi, openRepositories, provider);
}

export function deactivate() {}
