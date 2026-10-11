import { REGISTER } from '../constants/strings';
import { canonicalStateName } from './indiaStates';

export interface DistrictResult {
  readonly districts: string[];
  readonly isDatasetMissing: boolean;
  readonly message?: string;
}

// In-memory cache of parsed districts
let districtsDataCache: Record<string, string[]> | null = null;
let datasetMissingCache: boolean | null = null;

/**
 * Allows programmatic injection of the districts dataset (e.g. from tests or dynamic asset load).
 */
export function setDistrictsDataset(dataset: Record<string, string[]> | null): void {
  districtsDataCache = dataset;
  datasetMissingCache = dataset ? false : null;
}

/**
 * Checks if the dataset is currently loaded in memory.
 */
export function isDistrictsDatasetLoaded(): boolean {
  return districtsDataCache !== null;
}

/**
 * Attempts to load assets/data/india-districts.json.
 * Works in Node (via fs) and React Native / bundler environments if available.
 */
function tryLoadDistrictsDataset(): Record<string, string[]> | null {
  if (districtsDataCache !== null) {
    return districtsDataCache;
  }

  // 1. In Node / test environment, inspect filesystem paths
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const possiblePaths = [
      path.resolve(process.cwd(), 'assets/data/india-districts.json'),
      path.resolve(process.cwd(), 'mobile/assets/data/india-districts.json'),
      path.resolve(__dirname, '../../assets/data/india-districts.json'),
    ];
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        districtsDataCache = JSON.parse(raw);
        datasetMissingCache = false;
        return districtsDataCache;
      }
    }
  } catch {
    // Filesystem not available (e.g. standard React Native runtime)
  }

  // 2. In Metro bundler / Web environment:
  // Note: Metro only resolves static requires if the file exists on disk.
  try {
    // Dynamic lookup attempt
    const dynamicRequire =
      typeof (globalThis as any).__webpack_require__ === 'function' ? null : require;
    if (dynamicRequire) {
      const data = dynamicRequire('../../assets/data/india-districts.json');
      if (data && typeof data === 'object') {
        districtsDataCache = data;
        datasetMissingCache = false;
        return districtsDataCache;
      }
    }
  } catch {
    // File does not exist in bundle
  }

  datasetMissingCache = true;
  return null;
}

/**
 * Returns whether the india-districts.json dataset file exists and is loaded.
 */
export function hasDistrictsDataset(): boolean {
  if (datasetMissingCache !== null) {
    return !datasetMissingCache;
  }
  const dataset = tryLoadDistrictsDataset();
  return dataset !== null;
}

/**
 * Lazily loads districts for a given state name.
 * If the dataset file does not exist, returns an empty array, marks isDatasetMissing: true,
 * and includes a clear user-facing message.
 */
export async function getDistrictsForState(stateName?: string | null): Promise<DistrictResult> {
  if (!stateName) {
    return {
      districts: [],
      isDatasetMissing: !hasDistrictsDataset(),
    };
  }

  const dataset = tryLoadDistrictsDataset();

  if (!dataset) {
    return {
      districts: [],
      isDatasetMissing: true,
      message: REGISTER.DISTRICT_DATASET_MISSING,
    };
  }

  const canonical = canonicalStateName(stateName) || stateName.trim();

  // Look up state in dataset (case-insensitive fallback)
  let stateDistricts = dataset[canonical];
  if (!stateDistricts) {
    const lower = canonical.toLowerCase();
    for (const key of Object.keys(dataset)) {
      if (key.toLowerCase() === lower) {
        stateDistricts = dataset[key];
        break;
      }
    }
  }

  return {
    districts: Array.isArray(stateDistricts) ? [...stateDistricts] : [],
    isDatasetMissing: false,
  };
}
