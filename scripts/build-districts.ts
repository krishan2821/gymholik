import * as fs from 'fs';
import * as path from 'path';

/**
 * Script: build-districts.ts
 *
 * Converts a CSV file containing columns (state, district) into the required JSON structure:
 * {
 *   "<State name>": ["District 1", "District 2", ...]
 * }
 *
 * Usage:
 *   npx tsx scripts/build-districts.ts <path-to-csv> [optional-output-json-path]
 *   cat districts.csv | npx tsx scripts/build-districts.ts -
 */

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function buildDistrictsJson(csvContent: string): Record<string, string[]> {
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return {};
  }

  let stateIdx = 0;
  let districtIdx = 1;
  let startIndex = 0;

  // Check for header
  const firstRow = parseCsvLine(lines[0]);
  const lowerFirst = firstRow.map((c) => c.toLowerCase());
  const foundState = lowerFirst.findIndex((c) => c.includes('state'));
  const foundDistrict = lowerFirst.findIndex((c) => c.includes('district'));

  if (foundState !== -1 && foundDistrict !== -1) {
    stateIdx = foundState;
    districtIdx = foundDistrict;
    startIndex = 1;
  }

  const map = new Map<string, Set<string>>();

  for (let i = startIndex; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]);
    if (row.length <= Math.max(stateIdx, districtIdx)) continue;

    const state = row[stateIdx]?.trim();
    const district = row[districtIdx]?.trim();

    if (!state || !district) continue;

    if (!map.has(state)) {
      map.set(state, new Set<string>());
    }
    map.get(state)!.add(district);
  }

  // Format into sorted JSON object
  const sortedStates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  const result: Record<string, string[]> = {};

  for (const st of sortedStates) {
    const districts = Array.from(map.get(st)!).sort((a, b) => a.localeCompare(b));
    result[st] = districts;
  }

  return result;
}

function resolveOutputPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(process.cwd(), customPath);
  }
  if (fs.existsSync(path.resolve(process.cwd(), 'mobile'))) {
    return path.resolve(process.cwd(), 'mobile', 'assets', 'data', 'india-districts.json');
  }
  return path.resolve(process.cwd(), 'assets', 'data', 'india-districts.json');
}

async function main() {
  const args = process.argv.slice(2);
  const inputArg = args[0];
  const outputArg = args[1];

  if (!inputArg) {
    console.error('Error: CSV input file path required.');
    console.log('Usage: npx tsx scripts/build-districts.ts <path-to-districts.csv> [output-path]');
    process.exit(1);
  }

  let csvContent = '';
  if (inputArg === '-') {
    csvContent = fs.readFileSync(0, 'utf-8');
  } else {
    const resolvedInput = path.resolve(process.cwd(), inputArg);
    if (!fs.existsSync(resolvedInput)) {
      console.error(`Error: Input file does not exist: ${resolvedInput}`);
      process.exit(1);
    }
    csvContent = fs.readFileSync(resolvedInput, 'utf-8');
  }

  const result = buildDistrictsJson(csvContent);
  const outPath = resolveOutputPath(outputArg);
  const outDir = path.dirname(outPath);

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');

  const totalStates = Object.keys(result).length;
  const totalDistricts = Object.values(result).reduce((acc, curr) => acc + curr.length, 0);

  console.log(`✓ Generated india-districts.json:`);
  console.log(`  States: ${totalStates}`);
  console.log(`  Total Districts: ${totalDistricts}`);
  console.log(`  Saved to: ${outPath}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to build districts:', err);
    process.exit(1);
  });
}
