import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob'; // requires glob, let's install it or use fs

export async function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 20000
    });

    const testsRoot = path.resolve(__dirname, '.');

    // Use native Node fs to find tests to avoid adding glob dependency
    const fs = require('fs');
    function getTestFiles(dir: string, fileList: string[] = []) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const stat = fs.statSync(path.join(dir, file));
            if (stat.isDirectory()) {
                getTestFiles(path.join(dir, file), fileList);
            } else if (file.endsWith('.test.js') || file.endsWith('.test.ts')) {
                fileList.push(path.join(dir, file));
            }
        }
        return fileList;
    }

    const testFiles = getTestFiles(testsRoot);

    return new Promise((resolve, reject) => {
        // Add files to the test suite
        testFiles.forEach(f => mocha.addFile(f));

        try {
            // Run the mocha test
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}
