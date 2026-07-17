import * as vscode from 'vscode';
import { GitAPI, GitExtension } from '../types';

export function getGitApi(): GitAPI | undefined {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (!gitExtension) {
        vscode.window.showErrorMessage('VS Code Git extension not found.');
        return undefined;
    }

    const gitApi = gitExtension.exports.getAPI(1);
    if (!gitApi) {
        vscode.window.showErrorMessage('Failed to load Git API version 1.');
        return undefined;
    }

    return gitApi;
}
