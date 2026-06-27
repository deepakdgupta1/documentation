/**
 * Git Worktree Operations Module
 *
 * Handles safe Git worktree creation, format transformations, and cleanup.
 * All operations include safety guards for dirty state, branch conflicts,
 * and interrupt handling.
 */

import { execSync, type ExecSyncOptions } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorktreeContext {
  targetDir: string;
  worktreePath: string;
  branchName: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const execOpts = (cwd: string): ExecSyncOptions => ({
  cwd,
  encoding: 'utf-8',
  stdio: ['pipe', 'pipe', 'pipe'],
});

function git(args: string, cwd: string): string {
  return (execSync(`git ${args}`, execOpts(cwd)) as string).trim();
}

function isGitRepo(dir: string): boolean {
  try {
    git('rev-parse --is-inside-work-tree', dir);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate the Git state of the target directory before worktree operations.
 * Throws descriptive errors if the state is unsafe.
 */
export function validateGitState(targetDir: string): void {
  const resolved = path.resolve(targetDir);

  // 1. Must be inside a Git repository
  if (!isGitRepo(resolved)) {
    throw new Error(
      `"${resolved}" is not inside a Git repository. The worktree operation requires a valid Git repo.`
    );
  }

  // 2. Working tree must be clean (no uncommitted changes)
  const status = git('status --porcelain', resolved);
  if (status.length > 0) {
    throw new Error(
      'Working tree has uncommitted changes. Please commit or stash your changes before running the worktree transformation.\n\n' +
        `Dirty files:\n${status}`
    );
  }

  // 3. Check that a previous prep branch doesn't already exist as a worktree
  try {
    const worktrees = git('worktree list --porcelain', resolved);
    if (worktrees.includes('.git-docs-prep')) {
      throw new Error(
        'A previous worktree ".git-docs-prep" still exists. Clean it up with:\n' +
          '  git worktree remove .git-docs-prep --force'
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes('.git-docs-prep')) {
      throw e;
    }
    // `git worktree list` might fail on very old Git versions — allow to proceed
  }
}

// ---------------------------------------------------------------------------
// Worktree Lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a temporary Git worktree for safe format transformations.
 */
export function spawnWorktree(targetDir: string): WorktreeContext {
  const resolved = path.resolve(targetDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const branchName = `docs/prep-${timestamp}`;
  const worktreePath = path.join(resolved, '.git-docs-prep');

  // Create the worktree on a new branch from HEAD
  git(`worktree add -b "${branchName}" "${worktreePath}"`, resolved);

  console.log(`  ✅ Worktree created at .git-docs-prep on branch ${branchName}`);

  return { targetDir: resolved, worktreePath, branchName, timestamp };
}

/**
 * Apply format transformations inside the worktree:
 * - Rename files with spaces (using git mv)
 * - Inject minimal YAML frontmatter into files that lack it
 */
export function applyTransformations(ctx: WorktreeContext): void {
  const { worktreePath } = ctx;

  const markdownFiles = findMarkdownFilesRecursive(worktreePath);
  let renamed = 0;
  let frontmatterInjected = 0;

  for (const filePath of markdownFiles) {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath);

    // Rename files with spaces → dashes
    if (/\s/.test(basename)) {
      const newBasename = basename.replace(/\s+/g, '-');
      const newPath = path.join(dir, newBasename);
      git(`mv "${filePath}" "${newPath}"`, worktreePath);
      renamed++;
      // Continue processing with the new path
      injectFrontmatterIfMissing(newPath);
    } else {
      if (injectFrontmatterIfMissing(filePath)) {
        frontmatterInjected++;
      }
    }
  }

  console.log(`  📝 Renamed ${renamed} file(s), injected frontmatter into ${frontmatterInjected} file(s).`);
}

/**
 * Commit all changes in the worktree and clean up.
 */
export function commitAndCleanup(ctx: WorktreeContext): void {
  const { targetDir, worktreePath, branchName } = ctx;

  try {
    // Stage all changes
    git('add -A', worktreePath);

    // Check if there's anything to commit
    const status = git('status --porcelain', worktreePath);
    if (status.length === 0) {
      console.log('  ℹ️  No changes to commit.');
    } else {
      git(
        `commit -m "docs(prep): apply SOTA format transformations\n\nApplied by sota-docs prep CLI.\nBranch: ${branchName}"`,
        worktreePath
      );
      console.log(`  ✅ Changes committed on branch ${branchName}.`);
    }
  } finally {
    // Always clean up the worktree
    cleanupWorktree(ctx);
  }
}

/**
 * Remove the worktree and prune. Safe to call multiple times.
 */
export function cleanupWorktree(ctx: WorktreeContext): void {
  const { targetDir, worktreePath } = ctx;

  try {
    if (fs.existsSync(worktreePath)) {
      git(`worktree remove "${worktreePath}" --force`, targetDir);
      console.log('  🧹 Worktree cleaned up.');
    }
  } catch {
    // Last resort: manual cleanup
    try {
      fs.rmSync(worktreePath, { recursive: true, force: true });
      git('worktree prune', targetDir);
      console.log('  🧹 Worktree force-cleaned.');
    } catch {
      console.error(`  ⚠️  Could not clean up worktree at ${worktreePath}. Manual cleanup required.`);
    }
  }
}

/**
 * Register signal handlers to ensure worktree cleanup on interrupt.
 * Returns a function to deregister the handlers.
 */
export function registerCleanupHandlers(ctx: WorktreeContext): () => void {
  const handler = () => {
    console.log('\n\n  ⚠️  Interrupt received. Cleaning up worktree...');
    cleanupWorktree(ctx);
    process.exit(1);
  };

  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);

  return () => {
    process.removeListener('SIGINT', handler);
    process.removeListener('SIGTERM', handler);
  };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

function findMarkdownFilesRecursive(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', '.venv', '__pycache__'].includes(entry.name)) continue;
      findMarkdownFilesRecursive(fullPath, files);
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Inject minimal YAML frontmatter if a file lacks it.
 * Returns true if frontmatter was injected.
 */
function injectFrontmatterIfMissing(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.trimStart().startsWith('---')) return false;

  // Derive a title from the filename
  const basename = path.basename(filePath, path.extname(filePath));
  const title = basename
    .replace(/^\d+-/, '')          // remove leading numeric prefix
    .replace(/[-_]/g, ' ')         // dashes/underscores to spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()); // title case

  const frontmatter = `---\ntitle: "${title}"\n---\n\n`;
  fs.writeFileSync(filePath, frontmatter + content, 'utf-8');

  return true;
}
