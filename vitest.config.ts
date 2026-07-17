import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        root: __dirname,
        include: ['src/**/*.test.ts'],
        exclude: ['src/test/integration/**/*.test.ts'],
        globals: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'json-summary'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts', 'src/test/**', 'src/git/gitExtensionApi.ts'],
            thresholds: {
                'src/git/**': {
                    lines: 80,
                },
            },
        },
    },
    resolve: {
        alias: {
            // vscode is provided by the VS Code runtime and is not bundled.
            // Vitest needs a stub so imports don't fail at test time.
            vscode: path.resolve(__dirname, 'src/test/__mocks__/vscode.ts'),
        },
    },
});
