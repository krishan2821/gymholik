#!/usr/bin/env node
/**
 * audit-theme.js — Theme Guard Rail Script
 *
 * Verifies that:
 * 1. Raw palette files (e.g. palette.ts) are not directly imported outside src/theme/
 * 2. No StyleSheet.create calls at module scope reference theme/colors values
 * 3. No hex or rgba colour literals exist outside src/theme/
 * 4. Appearance.getColorScheme() / useColorScheme() are not called outside src/theme/useAppearance.ts
 *
 * Exits with code 1 if any violations are found.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const IGNORED_DIRS = ['node_modules', '.expo', '.git', 'dist', 'build', 'web-build'];

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

const files = getAllFiles(ROOT);
const violations = [];

const HEX_COLOR_REGEX = /['"]#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})['"]/;
const RGBA_COLOR_REGEX = /['"]rgba?\([^)]+\)['"]/;
const PALETTE_IMPORT_REGEX = /import\s+.*from\s+['"][^'"]*\/palette(\.[a-z]+)?['"]/;
const STATIC_STYLESHEET_REGEX = /const\s+styles\s*=\s*StyleSheet\.create\(/;

for (const filePath of files) {
  const relPath = path.relative(ROOT, filePath);
  const isThemeFolder = relPath.startsWith('src/theme/') || relPath.startsWith('src/theme\\');
  const isThemeContext = relPath.includes('ThemeContext');
  const isAuditScript = relPath.includes('audit-theme');
  const isTest = relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx');

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  // Check 1: Raw palette import outside theme folder
  if (!isThemeFolder && !isAuditScript) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (PALETTE_IMPORT_REGEX.test(line)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'no-restricted-imports (raw palette)',
          snippet: line.trim(),
        });
      }
    }
  }

  // Check 2: Appearance.getColorScheme or useColorScheme outside useAppearance.ts
  if (relPath !== 'src/theme/useAppearance.ts' && !isTest) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        (line.includes('Appearance.getColorScheme(') || line.includes('useColorScheme(')) &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*')
      ) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'centralized-appearance-rule',
          snippet: line.trim(),
        });
      }
    }
  }

  // Check 3: Static StyleSheet.create referencing theme values
  if (!isThemeFolder) {
    let inStaticStyleSheet = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (STATIC_STYLESHEET_REGEX.test(line)) {
        inStaticStyleSheet = true;
      }
      if (inStaticStyleSheet && line.includes('theme.')) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'no-static-theme-stylesheet (useStyles hook required)',
          snippet: line.trim(),
        });
      }
      if (inStaticStyleSheet && line.trim() === '});') {
        inStaticStyleSheet = false;
      }
    }
  }

  // Check 4: Hardcoded hex or rgba color literals outside theme folder
  if (!isThemeFolder && !isTest && !isAuditScript) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeOnly = line.split('//')[0].trim();
      // Skip pure comments or SVG path d strings that contain hashes
      if (codeOnly.startsWith('*') || codeOnly.startsWith('/*')) continue;

      if (HEX_COLOR_REGEX.test(codeOnly) || RGBA_COLOR_REGEX.test(codeOnly)) {
        violations.push({
          file: relPath,
          line: i + 1,
          rule: 'no-color-literals-outside-theme',
          snippet: codeOnly,
        });
      }
    }
  }
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
  process.exit(1);
} else {
  console.log('✅ PASSED: 0 violations found. All theme guard rails satisfied!\n');
  process.exit(0);
}
