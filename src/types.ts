import * as vscode from 'vscode';

// Defining minimal interfaces for Git Extension API v1
// To avoid bringing in the full @types/vscode-git which might be heavy or misaligned.

export interface GitExtension {
    getAPI(version: number): GitAPI;
}

export interface GitAPI {
    git: {
        path: string;
    };
    repositories: Repository[];
    onDidOpenRepository: vscode.Event<Repository>;
    onDidCloseRepository: vscode.Event<Repository>;
}

export interface Repository {
    rootUri: vscode.Uri;
}

export interface WorktreeInfo {
    path: string;
    commit: string;
    branch?: string;
    isBare?: boolean;
    isDetached?: boolean;
}
