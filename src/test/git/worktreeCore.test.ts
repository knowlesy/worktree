import { vi, describe, it, expect, beforeEach } from 'vitest';
import { execFile } from 'child_process';

// Mock child_process before importing the module under test.
vi.mock('child_process', () => ({
    execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

/**
 * Helper: configure the mocked execFile to invoke its callback with the given stdout.
 * `promisify(execFile)` passes (cmd, args, opts, callback) — we call the callback.
 */
function mockExecFileResult(stdout: string, stderr = ''): void {
    mockExecFile.mockImplementation(
        ((_cmd: unknown, _args: unknown, _opts: unknown, callback: Function) => {
            callback(null, { stdout, stderr });
        }) as any,
    );
}

/**
 * Helper: configure the mocked execFile to reject with an error.
 */
function mockExecFileError(message: string, code = 1): void {
    mockExecFile.mockImplementation(
        ((_cmd: unknown, _args: unknown, _opts: unknown, callback: Function) => {
            const err = new Error(message) as NodeJS.ErrnoException;
            (err as any).code = code;
            callback(err, { stdout: '', stderr: message });
        }) as any,
    );
}

import { listWorktrees, addWorktree, removeWorktree } from '../../git/worktreeCore';

// ─── listWorktrees ───────────────────────────────────────────────────────────

describe('listWorktrees', () => {
    const GIT = '/usr/bin/git';
    const REPO = '/home/user/project';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return an empty array when stdout is empty', async () => {
        mockExecFileResult('');
        const result = await listWorktrees(GIT, REPO);
        expect(result).toEqual([]);
    });

    it('should parse a single worktree entry', async () => {
        const porcelain = [
            'worktree /path/to/main',
            'HEAD abc123def456789',
            'branch refs/heads/main',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            path: '/path/to/main',
            commit: 'abc123def456789',
            branch: 'refs/heads/main',
        });
    });

    it('should parse multiple worktree entries', async () => {
        const porcelain = [
            'worktree /path/to/main',
            'HEAD aaa111',
            'branch refs/heads/main',
            '',
            'worktree /path/to/feature',
            'HEAD bbb222',
            'branch refs/heads/feature-x',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            path: '/path/to/main',
            commit: 'aaa111',
            branch: 'refs/heads/main',
        });
        expect(result[1]).toEqual({
            path: '/path/to/feature',
            commit: 'bbb222',
            branch: 'refs/heads/feature-x',
        });
    });

    it('should parse a detached HEAD worktree', async () => {
        const porcelain = [
            'worktree /path/to/detached',
            'HEAD 789abc',
            'detached',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            path: '/path/to/detached',
            commit: '789abc',
            isDetached: true,
        });
    });

    it('should parse a bare repository worktree', async () => {
        const porcelain = [
            'worktree /path/to/bare',
            'HEAD 000000',
            'bare',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            path: '/path/to/bare',
            commit: '000000',
            isBare: true,
        });
    });

    it('should parse mixed output (regular + detached + bare)', async () => {
        const porcelain = [
            'worktree /path/to/main',
            'HEAD abc123',
            'branch refs/heads/main',
            '',
            'worktree /path/to/feature',
            'HEAD def456',
            'branch refs/heads/feature-x',
            '',
            'worktree /path/to/detached',
            'HEAD 789abc',
            'detached',
            '',
            'worktree /path/to/bare',
            'HEAD 000000',
            'bare',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(4);

        // Regular
        expect(result[0]).toEqual({
            path: '/path/to/main',
            commit: 'abc123',
            branch: 'refs/heads/main',
        });

        // Feature branch
        expect(result[1]).toEqual({
            path: '/path/to/feature',
            commit: 'def456',
            branch: 'refs/heads/feature-x',
        });

        // Detached
        expect(result[2]).toEqual({
            path: '/path/to/detached',
            commit: '789abc',
            isDetached: true,
        });

        // Bare
        expect(result[3]).toEqual({
            path: '/path/to/bare',
            commit: '000000',
            isBare: true,
        });
    });

    it('should handle output without a trailing newline', async () => {
        // No trailing newline — the last entry has no blank-line terminator.
        const porcelain = [
            'worktree /path/to/main',
            'HEAD abc123',
            'branch refs/heads/main',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            path: '/path/to/main',
            commit: 'abc123',
            branch: 'refs/heads/main',
        });
    });

    it('should handle paths with spaces', async () => {
        const porcelain = [
            'worktree /path/to/my project',
            'HEAD abc123',
            'branch refs/heads/main',
            '',
        ].join('\n');

        mockExecFileResult(porcelain);
        const result = await listWorktrees(GIT, REPO);

        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('/path/to/my project');
    });

    it('should call execFile with the correct arguments', async () => {
        mockExecFileResult('');
        await listWorktrees(GIT, REPO);

        expect(mockExecFile).toHaveBeenCalledWith(
            GIT,
            ['worktree', 'list', '--porcelain'],
            { cwd: REPO },
            expect.any(Function),
        );
    });

    it('should propagate errors from execFile', async () => {
        mockExecFileError('fatal: not a git repository');
        await expect(listWorktrees(GIT, REPO)).rejects.toThrow('fatal: not a git repository');
    });

    it('should handle only whitespace in stdout', async () => {
        mockExecFileResult('   \n\n  \n');
        const result = await listWorktrees(GIT, REPO);
        expect(result).toEqual([]);
    });
});

// ─── addWorktree ─────────────────────────────────────────────────────────────

describe('addWorktree', () => {
    const GIT = '/usr/bin/git';
    const REPO = '/home/user/project';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call execFile with correct arguments to create a worktree', async () => {
        mockExecFileResult('');

        await addWorktree(GIT, REPO, 'feature-branch', '/tmp/worktrees/feature-branch');

        expect(mockExecFile).toHaveBeenCalledWith(
            GIT,
            ['worktree', 'add', '-b', 'feature-branch', '/tmp/worktrees/feature-branch'],
            { cwd: REPO },
            expect.any(Function),
        );
    });

    it('should propagate errors from execFile', async () => {
        mockExecFileError('fatal: branch already exists');
        await expect(
            addWorktree(GIT, REPO, 'existing', '/tmp/worktrees/existing'),
        ).rejects.toThrow('fatal: branch already exists');
    });
});

// ─── removeWorktree ──────────────────────────────────────────────────────────

describe('removeWorktree', () => {
    const GIT = '/usr/bin/git';
    const REPO = '/home/user/project';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should call execFile with correct arguments to remove a worktree', async () => {
        mockExecFileResult('');

        await removeWorktree(GIT, REPO, '/tmp/worktrees/feature-branch');

        expect(mockExecFile).toHaveBeenCalledWith(
            GIT,
            ['worktree', 'remove', '/tmp/worktrees/feature-branch'],
            { cwd: REPO },
            expect.any(Function),
        );
    });

    it('should propagate errors from execFile', async () => {
        mockExecFileError('fatal: not a valid worktree');
        await expect(
            removeWorktree(GIT, REPO, '/nonexistent'),
        ).rejects.toThrow('fatal: not a valid worktree');
    });
});
