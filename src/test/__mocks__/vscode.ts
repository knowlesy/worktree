// Minimal vscode module stub for unit tests.
// This file is resolved by the `vscode` alias in vitest.config.ts.

export const window = {
    showInformationMessage: (() => {}) as any,
    showErrorMessage: (() => {}) as any,
    showInputBox: (() => {}) as any,
    showQuickPick: (() => {}) as any,
    showWarningMessage: (() => {}) as any,
    createOutputChannel: (() => ({ appendLine: () => {}, show: () => {}, dispose: () => {} })) as any,
};

export const commands = {
    executeCommand: (() => {}) as any,
    registerCommand: (() => ({ dispose: () => {} })) as any,
};

export const Uri = {
    file: (path: string) => ({ fsPath: path, scheme: 'file', path }),
    parse: (value: string) => ({ fsPath: value, scheme: 'file', path: value }),
};

export class TreeItem {
    label?: string;
    collapsibleState?: number;
    constructor(label?: string, collapsibleState?: number) {
        this.label = label;
        this.collapsibleState = collapsibleState;
    }
}

export const TreeItemCollapsibleState = {
    None: 0,
    Collapsed: 1,
    Expanded: 2,
};

export class EventEmitter {
    event = () => {};
    fire = () => {};
    dispose = () => {};
}

export const extensions = {
    getExtension: (() => undefined) as any,
};

export const workspace = {
    workspaceFolders: [],
    getConfiguration: (() => ({
        get: () => undefined,
        update: () => Promise.resolve(),
    })) as any,
};
