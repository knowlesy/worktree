import { execFile } from 'child_process';
import { promisify } from 'util';
import { WorktreeInfo } from '../types';

const execFileAsync = promisify(execFile);

export async function branchExists(gitPath: string, repoPath: string, branchName: string): Promise<boolean> {
    try {
        await execFileAsync(gitPath, ['rev-parse', '--verify', branchName], { cwd: repoPath });
        return true;
    } catch {
        return false;
    }
}

export async function addWorktree(gitPath: string, repoPath: string, branchName: string, worktreeDir: string): Promise<void> {
    const exists = await branchExists(gitPath, repoPath, branchName);
    
    if (exists) {
        await execFileAsync(gitPath, ['worktree', 'add', '--', worktreeDir, branchName], {
            cwd: repoPath
        });
    } else {
        await execFileAsync(gitPath, ['worktree', 'add', '-b', branchName, '--', worktreeDir], {
            cwd: repoPath
        });
    }
}

export async function removeWorktree(gitPath: string, repoPath: string, worktreeDir: string): Promise<void> {
    await execFileAsync(gitPath, ['worktree', 'remove', '--', worktreeDir], {
        cwd: repoPath
    });
}

export async function listWorktrees(gitPath: string, repoPath: string): Promise<WorktreeInfo[]> {
    const { stdout } = await execFileAsync(gitPath, ['worktree', 'list', '--porcelain'], {
        cwd: repoPath
    });

    const worktrees: WorktreeInfo[] = [];
    const lines = stdout.split('\n');
    let currentWorktree: Partial<WorktreeInfo> | null = null;

    for (const line of lines) {
        if (!line.trim()) {
            if (currentWorktree && currentWorktree.path) {
                worktrees.push(currentWorktree as WorktreeInfo);
                currentWorktree = null;
            }
            continue;
        }

        if (line.startsWith('worktree ')) {
            if (currentWorktree && currentWorktree.path) {
                worktrees.push(currentWorktree as WorktreeInfo);
            }
            currentWorktree = { path: line.substring('worktree '.length) };
        } else if (line.startsWith('HEAD ') && currentWorktree) {
            currentWorktree.commit = line.substring('HEAD '.length);
        } else if (line.startsWith('branch ') && currentWorktree) {
            currentWorktree.branch = line.substring('branch '.length);
        } else if (line === 'bare' && currentWorktree) {
            currentWorktree.isBare = true;
        } else if (line === 'detached' && currentWorktree) {
            currentWorktree.isDetached = true;
        }
    }

    if (currentWorktree && currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
    }

    return worktrees;
}
