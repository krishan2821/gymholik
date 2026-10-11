import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  INDIA_STATES,
  INDIA_STATE_OPTIONS,
  isValidState,
  canonicalStateName,
} from './indiaStates';
import {
  GYM_TYPE_OPTIONS,
  getGymTypeLabel,
  getGymTypeCode,
  GYM_TYPE_LABEL_TO_CODE,
  GymTypeCode,
} from './gymTypes';
import {
  getDistrictsForState,
  hasDistrictsDataset,
  setDistrictsDataset,
} from './indiaDistricts';
import { buildDistrictsJson } from '../../scripts/build-districts';

describe('Registration Data & Helpers', () => {
  describe('India States (36 States & Union Territories)', () => {
    it('has exactly 36 states and union territories', () => {
      assert.equal(INDIA_STATES.length, 36);
      assert.equal(INDIA_STATE_OPTIONS.length, 36);
    });

    it('contains all required states and UTs', () => {
      assert.ok(INDIA_STATES.includes('Maharashtra'));
      assert.ok(INDIA_STATES.includes('Delhi'));
      assert.ok(INDIA_STATES.includes('Karnataka'));
      assert.ok(INDIA_STATES.includes('Ladakh'));
      assert.ok(INDIA_STATES.includes('Dadra and Nagar Haveli and Daman and Diu'));
      assert.ok(INDIA_STATES.includes('Andaman and Nicobar Islands'));
    });

    it('validates states with case-insensitive matching', () => {
      assert.equal(isValidState('Maharashtra'), true);
      assert.equal(isValidState('maharashtra'), true);
      assert.equal(isValidState('  DELHI  '), true);
      assert.equal(isValidState('California'), false);
      assert.equal(isValidState(''), false);
      assert.equal(isValidState(null), false);
    });

    it('returns canonical state name', () => {
      assert.equal(canonicalStateName('maharashtra'), 'Maharashtra');
      assert.equal(canonicalStateName('delhi'), 'Delhi');
      assert.equal(canonicalStateName('InvalidState'), null);
      assert.equal(canonicalStateName(null), null);
    });
  });

  describe('Gym Type Options (exact order and wording)', () => {
    const expectedOrderAndWording = [
      { label: 'Commercial Gyms', code: 'COMMERCIAL' },
      { label: 'Boutique Fitness Studios', code: 'BOUTIQUE_STUDIO' },
      { label: 'CrossFit Boxes', code: 'CROSSFIT_BOX' },
      { label: 'Bodybuilding & Powerlifting Gyms', code: 'BODYBUILDING_POWERLIFTING' },
      { label: 'Luxury / Premium Gyms', code: 'PREMIUM_LUXURY' },
      { label: 'Women-Only Gyms', code: 'WOMEN_ONLY' },
      { label: 'Home Gyms', code: 'HOME_GYM' },
    ];

    it('has exactly 7 gym types in the exact order and wording', () => {
      assert.equal(GYM_TYPE_OPTIONS.length, 7);

      expectedOrderAndWording.forEach((expected, index) => {
        const actual = GYM_TYPE_OPTIONS[index];
        assert.equal(actual.label, expected.label, `Label at index ${index} must match`);
        assert.equal(actual.value, expected.code, `Code at index ${index} must match`);
      });
    });

    it('maps labels and enum codes bidirectionally', () => {
      expectedOrderAndWording.forEach((item) => {
        assert.equal(getGymTypeLabel(item.code), item.label);
        assert.equal(getGymTypeCode(item.label), item.code as GymTypeCode);
      });
    });
  });

  describe('India Districts Lazy Loader', () => {
    beforeEach(() => {
      setDistrictsDataset(null);
    });

    it('reports missing dataset and returns empty list with message when JSON does not exist', async () => {
      const result = await getDistrictsForState('Maharashtra');
      assert.deepEqual(result.districts, []);
      assert.equal(result.isDatasetMissing, true);
      assert.ok(result.message?.includes('District dataset file is not available'));
    });

    it('loads districts properly when dataset is provided', async () => {
      setDistrictsDataset({
        Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
        Karnataka: ['Bengaluru', 'Mysuru'],
      });

      assert.equal(hasDistrictsDataset(), true);

      const mhResult = await getDistrictsForState('Maharashtra');
      assert.equal(mhResult.isDatasetMissing, false);
      assert.deepEqual(mhResult.districts, ['Mumbai', 'Pune', 'Nagpur']);

      const caseInsensitiveResult = await getDistrictsForState('karnataka');
      assert.equal(caseInsensitiveResult.isDatasetMissing, false);
      assert.deepEqual(caseInsensitiveResult.districts, ['Bengaluru', 'Mysuru']);
    });
  });

  describe('scripts/build-districts CSV parser', () => {
    it('correctly parses CSV content with headers into grouped, sorted JSON', () => {
      const csv = `state,district
Maharashtra,Pune
Maharashtra,Mumbai
Maharashtra,Pune
Karnataka,Bengaluru
Goa,North Goa
Goa,South Goa`;

      const result = buildDistrictsJson(csv);

      assert.deepEqual(Object.keys(result), ['Goa', 'Karnataka', 'Maharashtra']);
      assert.deepEqual(result['Maharashtra'], ['Mumbai', 'Pune']); // deduplicated and sorted
      assert.deepEqual(result['Karnataka'], ['Bengaluru']);
      assert.deepEqual(result['Goa'], ['North Goa', 'South Goa']);
    });

    it('handles quoted fields and spaces gracefully', () => {
      const csv = `"State","District"
"Tamil Nadu","Chennai"
"Tamil Nadu","Coimbatore"`;

      const result = buildDistrictsJson(csv);
      assert.deepEqual(result['Tamil Nadu'], ['Chennai', 'Coimbatore']);
    });
  });
});
