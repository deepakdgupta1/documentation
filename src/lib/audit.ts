/**
 * SOTA Documentation Audit Module
 *
 * Provides format auditing and SOTA architecture conformance checks.
 * Importable for programmatic use in CI pipelines or Astro integrations.
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditIssue {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface AuditResult {
  file: string;
  issues: AuditIssue[];
}

export interface SOTAPillar {
  present: boolean;
  details: string;
}

export interface SOTAReport {
  contextAnchor: SOTAPillar;
  systemBoundary: SOTAPillar;
  immutableLedger: SOTAPillar;
  apiSpec: SOTAPillar & { path?: string };
}

// ---------------------------------------------------------------------------
// Format Audit
// ---------------------------------------------------------------------------

/**
 * Recursively find all markdown files under a directory.
 */
function findMarkdownFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    // Skip common non-documentation directories
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.venv', '__pycache__', 'dist', '.astro'].includes(entry.name)) {
        continue;
      }
      findMarkdownFiles(fullPath, files);
    } else if (/\.(md|mdx)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if a markdown file has YAML frontmatter (starts with `---`).
 */
function hasFrontmatter(filePath: string): boolean {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.trimStart().startsWith('---');
}

/**
 * Audit markdown files for formatting issues:
 * - Missing YAML frontmatter
 * - Spaces in filenames
 * - Numeric prefix without dash separator (e.g., `01file.md` vs `01-file.md`)
 */
export function auditFormat(targetDir: string): AuditResult[] {
  const results: AuditResult[] = [];
  const files = findMarkdownFiles(targetDir);

  for (const filePath of files) {
    const issues: AuditIssue[] = [];
    const basename = path.basename(filePath);
    const relativePath = path.relative(targetDir, filePath);

    // Check for spaces in filename
    if (/\s/.test(basename)) {
      issues.push({
        code: 'FORMAT_SPACE_IN_FILENAME',
        message: `Filename contains spaces: "${basename}". Use dashes instead.`,
        severity: 'error',
      });
    }

    // Check for numeric prefix without dash separator
    if (/^\d+[A-Za-z]/.test(basename) && !/^\d+-/.test(basename)) {
      issues.push({
        code: 'FORMAT_NUMERIC_PREFIX',
        message: `Numeric prefix without dash separator: "${basename}". Use "01-filename.md" format.`,
        severity: 'warning',
      });
    }

    // Check for missing frontmatter
    if (!hasFrontmatter(filePath)) {
      issues.push({
        code: 'FORMAT_MISSING_FRONTMATTER',
        message: 'Missing YAML frontmatter. Every documentation file should begin with a --- delimited metadata block.',
        severity: 'error',
      });
    }

    if (issues.length > 0) {
      results.push({ file: relativePath, issues });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// SOTA Architecture Audit
// ---------------------------------------------------------------------------

/**
 * Check the Context Anchor pillar: README.md with System Objective and Repo Map.
 */
function checkContextAnchor(targetDir: string): SOTAPillar {
  const readmePath = path.join(targetDir, 'README.md');

  if (!fs.existsSync(readmePath)) {
    return { present: false, details: 'No README.md found at project root.' };
  }

  const content = fs.readFileSync(readmePath, 'utf-8');
  const hasObjective = /system\s*objective|purpose|overview/i.test(content);
  const hasRepoMap = /repo(sitory)?\s*map|directory\s*(tree|structure)|project\s*structure/i.test(content);

  if (!hasObjective && !hasRepoMap) {
    return {
      present: true,
      details: 'README.md exists but is missing System Objective and Repository Map sections.',
    };
  }

  const missing: string[] = [];
  if (!hasObjective) missing.push('System Objective');
  if (!hasRepoMap) missing.push('Repository Map');

  if (missing.length > 0) {
    return {
      present: true,
      details: `README.md is missing: ${missing.join(', ')}.`,
    };
  }

  return { present: true, details: 'README.md contains System Objective and Repository Map.' };
}

/**
 * Check the System Boundary pillar: architecture doc with Mermaid diagrams.
 */
function checkSystemBoundary(targetDir: string): SOTAPillar {
  // Search common locations for architecture documentation
  const candidates = [
    'architecture.md',
    'docs/architecture.md',
    'docs/architecture/overview.md',
    'docs/architecture/overview.mdx',
    'src/content/docs/architecture/overview.md',
    'src/content/docs/architecture/overview.mdx',
    'ARCHITECTURE.md',
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(targetDir, candidate);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const hasMermaid = /```mermaid/i.test(content);

      return {
        present: true,
        details: hasMermaid
          ? `Found ${candidate} with Mermaid diagrams.`
          : `Found ${candidate} but no Mermaid diagrams detected. Consider adding text-based diagrams for dual-consumption.`,
      };
    }
  }

  return {
    present: false,
    details: 'No architecture document found. Create an architecture.md with system diagrams.',
  };
}

/**
 * Check the Immutable Ledger pillar: sequential ADRs in a dedicated directory.
 */
function checkImmutableLedger(targetDir: string): SOTAPillar {
  // Search common ADR directory locations
  const adrCandidates = [
    'docs/architecture/adr',
    'docs/decision-log',
    'docs/adr',
    'adr',
    'src/content/docs/architecture/adr',
  ];

  for (const candidate of adrCandidates) {
    const adrDir = path.join(targetDir, candidate);
    if (fs.existsSync(adrDir) && fs.statSync(adrDir).isDirectory()) {
      const adrFiles = fs.readdirSync(adrDir).filter((f) => /\.md$/i.test(f));

      if (adrFiles.length === 0) {
        return {
          present: false,
          details: `ADR directory found at ${candidate}/ but contains no records. Initialize with 0001-record-architecture-decisions.md.`,
        };
      }

      // Check for sequential naming convention
      const sequential = adrFiles.filter((f) => /^\d{4}-/.test(f));
      if (sequential.length < adrFiles.length) {
        return {
          present: true,
          details: `Found ${adrFiles.length} ADRs in ${candidate}/, but ${adrFiles.length - sequential.length} files don't follow the sequential naming convention (0001-title.md).`,
        };
      }

      return {
        present: true,
        details: `Found ${sequential.length} sequential ADRs in ${candidate}/.`,
      };
    }
  }

  return {
    present: false,
    details: 'No ADR directory found. Create docs/architecture/adr/ with sequential decision records.',
  };
}

/**
 * Check the API Spec pillar: OpenAPI spec at project root or docs directory.
 */
function checkApiSpec(targetDir: string): SOTAPillar & { path?: string } {
  const candidates = [
    path.join(targetDir, 'openapi.yaml'),
    path.join(targetDir, 'openapi.json'),
    path.join(targetDir, 'docs', 'openapi.yaml'),
    path.join(targetDir, 'docs', 'openapi.json'),
    path.join(targetDir, 'swagger.yaml'),
    path.join(targetDir, 'swagger.json'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const relativePath = path.relative(targetDir, candidate);
      return {
        present: true,
        details: `OpenAPI specification found at ${relativePath}.`,
        path: candidate,
      };
    }
  }

  return {
    present: false,
    details: 'No OpenAPI specification found. Create an openapi.yaml at the project root.',
  };
}

/**
 * Run the full SOTA architecture conformance audit against a target directory.
 */
export function auditSOTA(targetDir: string): SOTAReport {
  const resolvedDir = path.resolve(targetDir);

  return {
    contextAnchor: checkContextAnchor(resolvedDir),
    systemBoundary: checkSystemBoundary(resolvedDir),
    immutableLedger: checkImmutableLedger(resolvedDir),
    apiSpec: checkApiSpec(resolvedDir),
  };
}

// ---------------------------------------------------------------------------
// Console Reporting
// ---------------------------------------------------------------------------

/**
 * Print a formatted audit report to the console.
 */
export function printReport(formatResults: AuditResult[], sotaReport: SOTAReport): void {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║        SOTA Documentation Audit Report          ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Format issues
  console.log('── Format Audit ──────────────────────────────────\n');
  if (formatResults.length === 0) {
    console.log('  ✅ All files pass format checks.\n');
  } else {
    let totalIssues = 0;
    for (const result of formatResults) {
      for (const issue of result.issues) {
        totalIssues++;
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`  ${icon} ${result.file}`);
        console.log(`     ${issue.message}\n`);
      }
    }
    console.log(`  Total: ${totalIssues} issue(s) across ${formatResults.length} file(s).\n`);
  }

  // SOTA pillars
  console.log('── SOTA Architecture Conformance ─────────────────\n');

  const pillars: [string, SOTAPillar][] = [
    ['Context Anchor (README.md)', sotaReport.contextAnchor],
    ['System Boundary (architecture)', sotaReport.systemBoundary],
    ['Immutable Ledger (ADRs)', sotaReport.immutableLedger],
    ['API Specification (OpenAPI)', sotaReport.apiSpec],
  ];

  let passing = 0;
  for (const [name, pillar] of pillars) {
    const icon = pillar.present ? '✅' : '❌';
    console.log(`  ${icon} ${name}`);
    console.log(`     ${pillar.details}\n`);
    if (pillar.present) passing++;
  }

  console.log(`── Score: ${passing}/4 SOTA pillars present ──────\n`);
}
