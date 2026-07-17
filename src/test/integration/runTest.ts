import * as path from 'path';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';
import { execSync } from 'child_process';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index.js');

        // Create a dummy workspace
        const testWorkspace = path.resolve(extensionDevelopmentPath, '.vscode-test-workspace');
        if (!fs.existsSync(testWorkspace)) {
            fs.mkdirSync(testWorkspace);
        }

        // Initialize git if not already initialized
        if (!fs.existsSync(path.join(testWorkspace, '.git'))) {
            execSync('git init', { cwd: testWorkspace });
            execSync('git config user.email "test@example.com"', { cwd: testWorkspace });
            execSync('git config user.name "Test User"', { cwd: testWorkspace });
            fs.writeFileSync(path.join(testWorkspace, 'README.md'), '# Test Workspace');
            execSync('git add README.md', { cwd: testWorkspace });
            execSync('git commit -m "Initial commit"', { cwd: testWorkspace });
        }

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspace,
                '--disable-extensions', // Disable other extensions to ensure a clean environment
            ]
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
