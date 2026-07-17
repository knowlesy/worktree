import * as assert from 'assert';
import * as vscode from 'vscode';
import { GitExtension } from '../../../types';

suite('Extension Integration Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('your-publisher-name.git-worktrees-native'));
    });

    test('Extension should activate successfully', async () => {
        const ext = vscode.extensions.getExtension('your-publisher-name.git-worktrees-native')!;
        await ext.activate();
        assert.strictEqual(ext.isActive, true);
    });

    test('Git API should be available and recognize the dummy repo', async () => {
        const ext = vscode.extensions.getExtension('your-publisher-name.git-worktrees-native')!;
        await ext.activate();

        const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
        assert.ok(gitExtension, 'vscode.git extension should be available');
        
        const gitApi = gitExtension.exports.getAPI(1);
        assert.ok(gitApi, 'Git API should be available');

        // Give it a moment to discover the repository
        await new Promise(resolve => setTimeout(resolve, 2000));

        assert.ok(gitApi.repositories.length > 0, 'Should have discovered at least one repository');
        
        const repoPath = gitApi.repositories[0].rootUri.fsPath;
        assert.ok(repoPath.endsWith('.vscode-test-workspace'), 'Should have discovered the dummy workspace repository');
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('git-worktrees.add'));
        assert.ok(commands.includes('git-worktrees.remove'));
        assert.ok(commands.includes('git-worktrees.switch'));
        assert.ok(commands.includes('git-worktrees.refresh'));
    });
});
