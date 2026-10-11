import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateUdyam,
  validateGstin,
  validateNic,
  validatePincode,
  validateLegalDoc,
  LEGAL_DOC_CONFIGS,
} from './legalDocs';

describe('Legal Document & Pincode Validators', () => {
  describe('Udyam Validator (^UDYAM-[A-Z]{2}-\\d{2}-\\d{7}$)', () => {
    it('accepts valid Udyam registration numbers', () => {
      assert.equal(validateUdyam('UDYAM-MH-12-0012345'), true);
      assert.equal(validateUdyam('UDYAM-DL-01-1234567'), true);
      assert.equal(validateUdyam('UDYAM-KA-09-7654321'), true);
      assert.equal(validateUdyam('UDYAM-GJ-04-0000001'), true);
      assert.equal(validateUdyam('  UDYAM-MH-12-0012345  '), true, 'handles whitespace trimming');
    });

    it('rejects invalid Udyam formats', () => {
      assert.equal(validateUdyam('udyam-mh-12-0012345'), false, 'lowercase is rejected');
      assert.equal(validateUdyam('UDYAMX-MH-12-0012345'), false, 'invalid prefix');
      assert.equal(validateUdyam('MSME-MH-12-0012345'), false, 'wrong prefix');
      assert.equal(validateUdyam('UDYAM-M-12-0012345'), false, 'single letter state code');
      assert.equal(validateUdyam('UDYAM-MHA-12-0012345'), false, '3 letter state code');
      assert.equal(validateUdyam('UDYAM-MH-1-0012345'), false, 'single digit subcode');
      assert.equal(validateUdyam('UDYAM-MH-123-0012345'), false, '3 digit subcode');
      assert.equal(validateUdyam('UDYAM-MH-12-001234'), false, '6 digits at end');
      assert.equal(validateUdyam('UDYAM-MH-12-00123456'), false, '8 digits at end');
      assert.equal(validateUdyam('UDYAMMH120012345'), false, 'missing hyphens');
      assert.equal(validateUdyam(''), false, 'empty string');
      assert.equal(validateUdyam(null), false, 'null');
      assert.equal(validateUdyam(undefined), false, 'undefined');
    });
  });

  describe('GSTIN Validator (^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$)', () => {
    it('accepts valid 15-character GSTIN numbers', () => {
      assert.equal(validateGstin('27AAPFU0939F1ZV'), true);
      assert.equal(validateGstin('07AAAAA0000A1Z5'), true);
      assert.equal(validateGstin('29ABCDE1234F2Z9'), true);
      assert.equal(validateGstin('36AAACH7409R1ZZ'), true);
      assert.equal(validateGstin('  27AAPFU0939F1ZV  '), true, 'handles whitespace trimming');
    });

    it('rejects invalid GSTIN formats', () => {
      assert.equal(validateGstin('27aapfu0939f1zv'), false, 'lowercase is rejected');
      assert.equal(validateGstin('27AAPFU0939F1Z'), false, '14 characters (too short)');
      assert.equal(validateGstin('27AAPFU0939F1ZVA'), false, '16 characters (too long)');
      assert.equal(validateGstin('27AAPFU0939F1AV'), false, '14th character must be Z');
      assert.equal(validateGstin('XXAAPFU0939F1ZV'), false, 'state code must be digits');
      assert.equal(validateGstin('27123450939F1ZV'), false, 'PAN part must start with 5 letters');
      assert.equal(validateGstin('27AAPFUABCD1ZV'), false, 'PAN part requires 4 digits');
      assert.equal(validateGstin('27AAPFU093901ZV'), false, 'entity number cannot be 0');
      assert.equal(validateGstin('27AAPFU0939F1Z@'), false, 'invalid check character');
      assert.equal(validateGstin(''), false, 'empty string');
      assert.equal(validateGstin(null), false, 'null');
      assert.equal(validateGstin(undefined), false, 'undefined');
    });
  });

  describe('NIC Validator (^\\d{4,5}$)', () => {
    it('accepts valid 4 or 5 digit NIC codes', () => {
      assert.equal(validateNic('9311'), true, '4 digits');
      assert.equal(validateNic('9312'), true, '4 digits');
      assert.equal(validateNic('93110'), true, '5 digits');
      assert.equal(validateNic('93120'), true, '5 digits');
      assert.equal(validateNic('01234'), true, '5 digits starting with 0');
      assert.equal(validateNic('  93110  '), true, 'handles whitespace trimming');
    });

    it('rejects invalid NIC codes', () => {
      assert.equal(validateNic('931'), false, '3 digits (too short)');
      assert.equal(validateNic('931100'), false, '6 digits (too long)');
      assert.equal(validateNic('9311A'), false, 'contains alphabet');
      assert.equal(validateNic('NIC01'), false, 'contains prefix');
      assert.equal(validateNic('93-11'), false, 'contains hyphen');
      assert.equal(validateNic(''), false, 'empty string');
      assert.equal(validateNic(null), false, 'null');
      assert.equal(validateNic(undefined), false, 'undefined');
    });
  });

  describe('Pincode Validator (^[1-9][0-9]{5}$)', () => {
    it('accepts valid 6-digit Indian PIN codes', () => {
      assert.equal(validatePincode('411001'), true, 'Pune pincode');
      assert.equal(validatePincode('110001'), true, 'Delhi pincode');
      assert.equal(validatePincode('560001'), true, 'Bangalore pincode');
      assert.equal(validatePincode('400001'), true, 'Mumbai pincode');
      assert.equal(validatePincode('700001'), true, 'Kolkata pincode');
      assert.equal(validatePincode('600001'), true, 'Chennai pincode');
      assert.equal(validatePincode('  411001  '), true, 'handles whitespace trimming');
    });

    it('rejects invalid Indian PIN codes', () => {
      assert.equal(validatePincode('011001'), false, 'starts with 0');
      assert.equal(validatePincode('000000'), false, 'all zeros');
      assert.equal(validatePincode('41100'), false, '5 digits (too short)');
      assert.equal(validatePincode('4110010'), false, '7 digits (too long)');
      assert.equal(validatePincode('41100A'), false, 'contains alphabet');
      assert.equal(validatePincode('411 001'), false, 'contains space');
      assert.equal(validatePincode('411-001'), false, 'contains hyphen');
      assert.equal(validatePincode(''), false, 'empty string');
      assert.equal(validatePincode(null), false, 'null');
      assert.equal(validatePincode(undefined), false, 'undefined');
    });
  });

  describe('validateLegalDoc dispatcher & configs', () => {
    it('dispatches properly by type', () => {
      assert.equal(validateLegalDoc('UDYAM', 'UDYAM-MH-12-0012345'), true);
      assert.equal(validateLegalDoc('UDYAM', 'INVALID'), false);

      assert.equal(validateLegalDoc('GSTIN', '27AAPFU0939F1ZV'), true);
      assert.equal(validateLegalDoc('GSTIN', 'INVALID'), false);

      assert.equal(validateLegalDoc('NIC', '93110'), true);
      assert.equal(validateLegalDoc('NIC', '123'), false);
    });

    it('has complete configuration for each legal doc type', () => {
      (['UDYAM', 'GSTIN', 'NIC'] as const).forEach((type) => {
        const config = LEGAL_DOC_CONFIGS[type];
        assert.ok(config, `Config exists for ${type}`);
        assert.ok(config.label.length > 0, `Label exists for ${type}`);
        assert.ok(config.placeholder.length > 0, `Placeholder exists for ${type}`);
        assert.ok(config.maxLength > 0, `MaxLength > 0 for ${type}`);
        assert.ok(config.keyboardType, `KeyboardType defined for ${type}`);
        assert.ok(typeof config.autoUppercase === 'boolean', `AutoUppercase boolean for ${type}`);
        assert.ok(config.hintText.length > 0, `HintText defined for ${type}`);
        assert.ok(typeof config.validator === 'function', `Validator function for ${type}`);
      });
    });
  });
});
