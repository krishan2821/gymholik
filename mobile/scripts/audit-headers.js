#!/usr/bin/env node
/**
 * audit-headers.js — Header & Safe Area Guard Rail Script
 *
 * Enforces strict header architecture across Gymholik Mobile:
 * Rule 1: Every _layout.tsx in app/ must configure headerShown: false in screenOptions and never set headerShown: true.
 * Rule 2: Screen files must not configure native headers (<Stack.Screen>, <Tabs.Screen>, setOptions).
 * Rule 3: Every screen in app/ must render with the unified <Screen> component.
 *
 * Exits with code 1 if any violations are found.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = ['node_modules', '.expo', '.git', 'dist', 'build', 'web-build'];

function getAllFiles(dir, exts = ['.tsx', '.ts']) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const dirent of list) {
    if (IGNORED_DIRS.includes(dirent.name)) continue;
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      results = results.concat(getAllFiles(fullPath, exts));
    } else if (dirent.isFile() && exts.some((ext) => dirent.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Audits code content against Header & Safe Area rules.
 * @param {string} content File source code
 * @param {string} relPath Path relative to mobile root
 * @returns {Array<{file: string, line: number, rule: string, snippet: string}>}
 */
function auditHeadersCode(content, relPath) {
  const violations = [];
  const normalized = relPath.replace(/\\/g, '/');

  // Skip non-app files and special expo router templates (+html.tsx)
  if (!normalized.startsWith('app/') || normalized.includes('+html.tsx')) {
    return violations;
  }

  const isLayout = normalized.endsWith('_layout.tsx');
  const lines = content.split('\n');

  if (isLayout) {
    // ── Rule 1: _layout.tsx must configure headerShown: false ──────────────────
    const hasHeaderShownFalse = /headerShown\s*:\s*false/.test(content);
    if (!hasHeaderShownFalse) {
      violations.push({
        file: relPath,
        line: 1,
        rule: 'Rule 1: Layout must configure headerShown: false in screenOptions',
        snippet: 'Missing headerShown: false in _layout',
      });
    }

    // Must never set headerShown: true
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/headerShown\s*:\s*true/.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'Rule 1: Layout must never enable native headers (headerShown: true forbidden)',
          snippet: line.trim(),
        });
      }
    }
  } else {
    // ── Rule 2: Screens must not configure native headers ─────────────────────
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/<(?:Stack|Tabs)\.Screen\b/.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'Rule 2: Screens must not configure native <Stack.Screen> or <Tabs.Screen> (layouts own routes)',
          snippet: line.trim(),
        });
      }
      if (/\bsetOptions\s*\(\s*\{.*header/.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'Rule 2: Screens must not configure native headers via setOptions',
          snippet: line.trim(),
        });
      }
    }

    // ── Rule 3: Screens must use the shared <Screen> component ────────────────
    const usesScreen = /<Screen\b/.test(content);
    if (!usesScreen) {
      violations.push({
        file: relPath,
        line: 1,
        rule: 'Rule 3: Screen must render with the shared <Screen> component',
        snippet: 'Missing <Screen> component wrapper',
      });
    }

    // ── Rule 4: Pushed screens must use <PageHeader> ──────────────────────────
    const isPushedScreen = (
      (normalized.startsWith('app/(tabs)/more/') ||
       normalized.startsWith('app/(tabs)/members/') ||
       normalized.startsWith('app/(tabs)/attendance/') ||
       normalized.startsWith('app/(tabs)/payments/')) &&
      !normalized.endsWith('/index.tsx') &&
      !normalized.endsWith('/scan.tsx') &&
      !normalized.endsWith('/dues.tsx')
    );

    if (isPushedScreen) {
      const usesPageHeader = /<PageHeader\b/.test(content);
      if (!usesPageHeader) {
        violations.push({
          file: relPath,
          line: 1,
          rule: 'Rule 4: Pushed screens under more/*, members/*, attendance/*, payments/* must use <PageHeader>',
          snippet: 'Missing <PageHeader> component in pushed screen',
        });
      }
    }

    // ── Rule 5: PageHeader right slot must be compact (<= 40% width, never fullWidth) ──
    const propMatches = [...content.matchAll(/\b(?:rightAction|right)\s*=\s*\{/g)];
    for (const pMatch of propMatches) {
      const startIndex = pMatch.index + pMatch[0].length;
      let depth = 1;
      let endIndex = startIndex;
      while (endIndex < content.length && depth > 0) {
        if (content[endIndex] === '{') depth++;
        else if (content[endIndex] === '}') depth--;
        endIndex++;
      }
      const slotContent = content.substring(startIndex, endIndex - 1);
      if (/<Button\b/.test(slotContent) && !/fullWidth\s*=\s*\{\s*false\s*\}/.test(slotContent)) {
        violations.push({
          file: relPath,
          line: 1,
          rule: 'Rule 5: PageHeader right slot Button must set fullWidth={false} to prevent squashing the title',
          snippet: slotContent.trim().substring(0, 100),
        });
      }
      if (/width\s*:\s*['"]?(?:100%|[5-9][0-9]%|4[1-9]%)/.test(slotContent) || /flex\s*:\s*1\b/.test(slotContent)) {
        violations.push({
          file: relPath,
          line: 1,
          rule: 'Rule 5: PageHeader right slot must not exceed 40% width (got width > 40% or flex: 1)',
          snippet: slotContent.trim().substring(0, 100),
        });
      }
    }
  }

  return violations;
}

function runAudit() {
  const appDir = path.join(ROOT, 'app');
  const files = getAllFiles(appDir, ['.tsx']);

  let allViolations = [];
  for (const file of files) {
    const relPath = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');
    const violations = auditHeadersCode(content, relPath);
    allViolations = allViolations.concat(violations);
  }

  console.log('\n=== Header & Safe Area Architecture Audit ===');
  console.log(`Audited ${files.length} app route files.\n`);

  if (allViolations.length > 0) {
    console.error(`FAILED: Found ${allViolations.length} header architecture violation(s):\n`);
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    [${v.rule}]`);
      console.error(`    Snippet: ${v.snippet}\n`);
    }
    process.exit(1);
  }

  console.log('PASSED: All layouts enforce headerShown: false.');
  console.log('PASSED: No screens configure native headers.');
  console.log('PASSED: All screens render inside the shared <Screen> component.');
  console.log('PASSED: All pushed screens render with the shared <PageHeader> component.');
  console.log('PASSED: All PageHeader right slots are compact and do not exceed 40% width.\n');
  process.exit(0);
}

if (require.main === module) {
  runAudit();
}

module.exports = { auditHeadersCode, runAudit };
