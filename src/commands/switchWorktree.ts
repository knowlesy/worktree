import * as vscode from 'vscode';
import { WorktreeNode } from '../views/worktreeNode';

export async function switchWorktreeCommand(node?: WorktreeNode) {
    if (!node) {
        vscode.window.showInformationMessage('Use the Git Worktrees view to switch worktrees.');
        return;
    }

    const uri = vscode.Uri.file(node.worktree.path);
    
    // Check if the folder is already in the workspace
    const folders = vscode.workspace.workspaceFolders;
    const exists = folders?.find(f => f.uri.fsPath === uri.fsPath);
    
    if (exists) {
        // Just open a new window pointing to that folder to "switch" to it effectively,
        // or just focus it if we want. In VS Code, switching branches in worktrees often
        // means opening that specific folder.
        vscode.commands.executeCommand('vscode.openFolder', uri, false);
    } else {
        // Add to workspace
        vscode.workspace.updateWorkspaceFolders(
            folders ? folders.length : 0, 
            0, 
            { uri: uri }
        );
    }
}
