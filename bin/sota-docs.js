#!/usr/bin/env node

/**
 * sota-docs CLI
 *
 * A reusable CLI tool that any Git repository can invoke to:
 *   - Audit its documentation against the SOTA standard
 *   - Serve it through a production-grade Astro Starlight engine
 *
 * Usage:
 *   sota-docs prep  [--dir <path>]   Audit and optionally transform a target repo
 *   sota-docs dev   [--dir <path>]   Start Astro dev server pointing at target repo
 *   sota-docs build [--dir <path>]   Production build pointing at target repo
 */

import { program } from 'commander';
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

// Resolve the engine's root directory (where this package lives)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENGINE_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Locate the documentation directory inside a target repo.
 * Searches common conventions in order of specificity.
 */
function resolveDocsDir(targetDir, docsSubdir) {
  if (docsSubdir) {
    const explicit = path.resolve(targetDir, docsSubdir);
    if (!fs.existsSync(explicit)) {
      console.error(`❌ Specified docs subdirectory does not exist: ${explicit}`);
      process.exit(1);
    }
    return explicit;
  }

  // Search common conventions
  const candidates = [
    'src/content/docs',
    'docs',
    '.',
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(targetDir, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      // Only match if it contains at least one markdown file
      const hasMarkdown = fs.readdirSync(fullPath, { recursive: true })
        .some((f) => /\.(md|mdx)$/i.test(String(f)));
      if (hasMarkdown) {
        return fullPath;
      }
    }
  }

  console.error('❌ Could not locate a documentation directory in the target repo.');
  console.error('   Use --docs-subdir to specify the path explicitly.');
  process.exit(1);
}

/**
 * Create a symlink from the engine's content/docs to the target docs directory.
 * Returns a cleanup function that restores the original directory.
 */
function createContentSymlink(targetDocsDir) {
  const contentDocsPath = path.join(ENGINE_ROOT, 'src', 'content', 'docs');
  const backupPath = path.join(ENGINE_ROOT, 'src', 'content', '.docs-backup');

  // Auto-recover from a previous crashed run
  if (fs.existsSync(backupPath)) {
    let recovered = false;
    try {
      if (fs.lstatSync(contentDocsPath).isSymbolicLink()) {
        fs.unlinkSync(contentDocsPath);
        recovered = true;
      }
    } catch (e) {
      // Ignored: doesn't exist
    }
    
    // Using try/catch to safely check if contentDocsPath exists as a real directory/file
    let contentExists = true;
    try {
      fs.lstatSync(contentDocsPath);
    } catch (e) {
      contentExists = false;
    }

    if (!contentExists) {
      fs.renameSync(backupPath, contentDocsPath);
      recovered = true;
    }
    
    if (recovered) {
      console.log('  🔄 Recovered original docs from previous crashed run.\n');
    }
  }

  // Check if the target is the engine itself (self-referential case)
  const resolvedTarget = path.resolve(targetDocsDir);
  const resolvedContentDocs = path.resolve(contentDocsPath);
  if (resolvedTarget === resolvedContentDocs) {
    console.log('  ℹ️  Target is the engine itself — no symlink needed.\n');
    return () => {}; // No-op cleanup
  }

  // Back up existing content/docs
  try {
    if (fs.lstatSync(contentDocsPath).isSymbolicLink()) {
      // Previous run left a dangling symlink — just remove it
      fs.unlinkSync(contentDocsPath);
    } else {
      // Real directory — back it up
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true, force: true });
      }
      fs.renameSync(contentDocsPath, backupPath);
    }
  } catch (e) {
    // Does not exist, nothing to back up
  }

  // Create symlink
  fs.symlinkSync(resolvedTarget, contentDocsPath, 'dir');
  console.log(`  🔗 Symlinked: src/content/docs → ${path.relative(ENGINE_ROOT, resolvedTarget)}\n`);

  // Return cleanup function
  return () => {
    try {
      if (fs.existsSync(contentDocsPath) && fs.lstatSync(contentDocsPath).isSymbolicLink()) {
        fs.unlinkSync(contentDocsPath);
      }
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, contentDocsPath);
        console.log('\n  🔄 Restored original src/content/docs/');
      }
    } catch (err) {
      console.error(`\n  ⚠️  Cleanup error: ${err.message}`);
      console.error(`     Manual restore: mv ${backupPath} ${contentDocsPath}`);
    }
  };
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

program
  .name('sota-docs')
  .description('SOTA Docs-as-Code Engine — Audit, serve, and build documentation for any repository.')
  .version('0.1.0');

// ── prep ──────────────────────────────────────────────────────────────────

program
  .command('prep')
  .description('Audit a target repository against the SOTA documentation standard and optionally apply format fixes.')
  .option('-d, --dir <path>', 'Target repository root directory', process.cwd())
  .action(async (options) => {
    const targetDir = path.resolve(options.dir);
    console.log(`\n  📂 Target: ${targetDir}\n`);

    // Dynamic import of TypeScript modules (compiled by the engine's toolchain)
    // For now, we inline the audit logic since the CLI is plain JS
    // In a published package, these would be pre-compiled
    const { auditFormat, auditSOTA, printReport } = await import('../src/lib/audit.ts');

    const formatResults = auditFormat(targetDir);
    const sotaReport = auditSOTA(targetDir);
    printReport(formatResults, sotaReport);

    // Prompt for worktree transformation if there are format issues
    if (formatResults.length > 0) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const answer = await new Promise((resolve) => {
        rl.question('  Apply format fixes in a separate Git worktree? (y/n): ', resolve);
      });
      rl.close();

      if (String(answer).toLowerCase() === 'y') {
        const { validateGitState, spawnWorktree, applyTransformations, commitAndCleanup, registerCleanupHandlers } =
          await import('../src/lib/worktree.ts');

        try {
          validateGitState(targetDir);
          const ctx = spawnWorktree(targetDir);
          const deregister = registerCleanupHandlers(ctx);

          try {
            applyTransformations(ctx);
            commitAndCleanup(ctx);
          } finally {
            deregister();
          }

          console.log(`\n  ✅ Format fixes applied on branch: ${ctx.branchName}`);
          console.log(`     Review and merge: git diff main..${ctx.branchName}\n`);
        } catch (err) {
          console.error(`\n  ❌ Worktree operation failed: ${err.message}\n`);
          process.exit(1);
        }
      }
    }
  });

// ── dev ───────────────────────────────────────────────────────────────────

program
  .command('dev')
  .description('Start the Astro dev server pointing at the target repository\'s documentation.')
  .option('-d, --dir <path>', 'Target repository root directory', process.cwd())
  .option('--docs-subdir <path>', 'Subdirectory containing documentation (auto-detected if not set)')
  .option('-p, --port <port>', 'Dev server port', '4321')
  .action((options) => {
    const targetDir = path.resolve(options.dir);
    const docsDir = resolveDocsDir(targetDir, options.docsSubdir);

    console.log(`\n  📂 Target repo: ${targetDir}`);
    console.log(`  📄 Docs dir:    ${docsDir}`);

    const cleanup = createContentSymlink(docsDir);

    // Set environment variables for astro.config.mjs
    const env = {
      ...process.env,
      TARGET_REPO_ROOT: targetDir,
      TARGET_DOCS_DIR: docsDir,
    };

    const astro = spawn('npx', ['astro', 'dev', '--port', options.port], {
      cwd: ENGINE_ROOT,
      env,
      stdio: 'inherit',
    });

    // Cleanup on exit (normal or signal)
    const handleExit = (code) => {
      cleanup();
      process.exit(typeof code === 'number' ? code : 0);
    };

    astro.on('close', handleExit);
    process.on('SIGINT', () => {
      astro.kill('SIGINT');
      cleanup();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      astro.kill('SIGTERM');
      cleanup();
      process.exit(0);
    });
  });

// ── build ─────────────────────────────────────────────────────────────────

program
  .command('build')
  .description('Run a production build of the documentation engine pointing at the target repository.')
  .option('-d, --dir <path>', 'Target repository root directory', process.cwd())
  .option('--docs-subdir <path>', 'Subdirectory containing documentation (auto-detected if not set)')
  .action(async (options) => {
    const targetDir = path.resolve(options.dir);
    const docsDir = resolveDocsDir(targetDir, options.docsSubdir);

    console.log(`\n  📂 Target repo: ${targetDir}`);
    console.log(`  📄 Docs dir:    ${docsDir}`);

    console.log(`\n  🔍 Auditing documents format and SOTA readiness...`);
    const { auditFormat, auditSOTA, printReport } = await import('../src/lib/audit.ts');
    
    const formatResults = auditFormat(targetDir);
    const sotaReport = auditSOTA(targetDir);
    
    console.log(`\n  📋 Format Readiness: ${formatResults.length === 0 ? '✅ Ready' : `⚠️ ${formatResults.length} issue(s) found`}`);
    console.log(`  📋 SOTA Audit: Evaluated current set of documents`);
    
    printReport(formatResults, sotaReport);

    const cleanup = createContentSymlink(docsDir);

    try {
      execSync('npx astro build', {
        cwd: ENGINE_ROOT,
        stdio: 'inherit',
        env: {
          ...process.env,
          TARGET_REPO_ROOT: targetDir,
          TARGET_DOCS_DIR: docsDir,
        },
      });

      console.log('\n  ✅ Build completed successfully.');
      console.log(`  📁 Output: ${path.join(ENGINE_ROOT, 'dist')}\n`);
    } catch (err) {
      console.error('\n  ❌ Build failed.\n');
      process.exit(1);
    } finally {
      cleanup();
    }
  });

// ── Parse ─────────────────────────────────────────────────────────────────

program.parse();
