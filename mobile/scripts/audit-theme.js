#!/usr/bin/env node
/**
 * audit-theme.js — Theme Guard Rail Script
 *
 * Enforces 4 strict design system rules:
 * Rule 1: No module-scope StyleSheet.create whose body reads theme, colors, or palette values.
 * Rule 2: No hex or rgba color literals outside src/theme (including shadowColor and overlays).
 * Rule 3: No imports of raw palette files (palette.ts, cobaltDark, cobaltLight, etc.) outside src/theme.
 * Rule 4: No useColorScheme or Appearance usage outside the provider (src/theme/ThemeContext.tsx).
 *
 * Exits with code 1 if any violations are found.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = ['node_modules', '.expo', '.git', 'dist', 'build', 'web-build'];

const HEX_COLOR_REGEX = /['"`]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"`]/;
const RGBA_COLOR_REGEX = /['"`]rgba?\([^)]+\)['"`]/;
const PALETTE_IMPORT_REGEX = /import\s+.*from\s+['"][^'"]*\/palette(\.[a-z]+)?['"]|import\s+.*\{[^}]*\b(?:cobaltDark|cobaltLight|emberDark|emberLight)\b[^}]*\}\s+from/;

function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  let results = [];
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
 * Audits source code for theme rule violations.
 * @param {string} content Source code string
 * @param {string} relPath Relative file path for reporting and rule exemption
 * @returns {Array<{file: string, line: number, rule: string, snippet: string}>}
 */
function auditCode(content, relPath) {
  const violations = [];
  const normalized = relPath.replace(/\\/g, '/');
  const isThemeFolder = normalized.startsWith('src/theme/');
  const isThemeProvider = normalized === 'src/theme/ThemeContext.tsx';
  const isAuditScript = normalized.includes('audit-theme');
  const isTestOrFixture =
    normalized.endsWith('.test.ts') ||
    normalized.endsWith('.test.tsx') ||
    normalized.includes('__tests__') ||
    normalized.includes('fixtures');

  const lines = content.split('\n');

  // Rule 1: No module-scope StyleSheet.create referencing theme/colors/palette
  if (!isThemeFolder) {
    let inStatic = false;
    let braceDepth = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const code = line.split('//')[0];

      if (!inStatic && /(?:export\s+)?const\s+[A-Za-z0-9_]+\s*=\s*StyleSheet\.create\(/.test(code)) {
        inStatic = true;
        braceDepth = (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
        continue;
      }

      if (inStatic) {
        braceDepth += (code.match(/\{/g) || []).length - (code.match(/\}/g) || []).length;
        if (/\b(?:theme|colors|palette)\b/.test(code) && !code.includes('import') && !code.includes('useStyles')) {
          violations.push({
            file: relPath,
            line: i + 1,
            rule: 'no-static-theme-stylesheet (StyleSheet.create at module scope must not read theme, colors or palette)',
            snippet: line.trim(),
          });
        }
        if (braceDepth <= 0 || /^\}\);?$/.test(line.trim())) {
          inStatic = false;
        }
      }
    }
  }

  // Rule 2: No hex or rgba literals outside src/theme (skip tests/fixtures)
  if (!isThemeFolder && !isTestOrFixture && !isAuditScript) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeOnly = line.split('//')[0].trim();
      if (codeOnly.startsWith('*') || codeOnly.startsWith('/*')) continue;

      if (HEX_COLOR_REGEX.test(codeOnly) || RGBA_COLOR_REGEX.test(codeOnly)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'no-color-literals-outside-theme (hex/rgba literal found outside src/theme)',
          snippet: codeOnly,
        });
      }
    }
  }

  // Rule 3: No raw palette imports outside src/theme
  if (!isThemeFolder && !isAuditScript && !isTestOrFixture) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeOnly = line.split('//')[0].trim();
      if (codeOnly.startsWith('*') || codeOnly.startsWith('/*')) continue;

      if (PALETTE_IMPORT_REGEX.test(codeOnly)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'no-restricted-imports (raw palette imported outside src/theme)',
          snippet: line.trim(),
        });
      }
    }
  }

  // Rule 4: No useColorScheme or Appearance outside the provider (ThemeContext.tsx)
  if (!isThemeProvider && !isTestOrFixture && !isAuditScript) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let codeOnly = line.split('//')[0].trim();
      codeOnly = codeOnly.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').trim();
      if (codeOnly.startsWith('*') || codeOnly.startsWith('/*')) continue;

      if (/\bAppearance\./.test(codeOnly) || /\buseColorScheme\s*\(/.test(codeOnly)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'centralized-appearance-rule (useColorScheme and Appearance are restricted to ThemeContext.tsx)',
          snippet: line.trim(),
        });
      }
    }
  }

  return violations;
}

function runAudit() {
  const files = getAllFiles(ROOT);
  const violations = [];

  for (const filePath of files) {
    const relPath = path.relative(ROOT, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const fileViolations = auditCode(content, relPath);
    violations.push(...fileViolations);
  }

  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('🔍 Gymholik Theme Guard Rail Audit');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log(`Scanned ${files.length} TypeScript files.`);

  if (violations.length > 0) {
    console.error(`\n❌ FAILED: Found ${violations.length} theme rule violation(s):\n`);
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} [${v.rule}]`);
      console.error(`    ${v.snippet}\n`);
    }
    return { success: false, violations };
  } else {
    console.log('✅ PASSED: 0 violations found. All theme guard rails satisfied!\n');
    return { success: true, violations: [] };
  }
}

if (require.main === module) {
  const result = runAudit();
  process.exit(result.success ? 0 : 1);
}

module.exports = {
  auditCode,
  runAudit,
};
