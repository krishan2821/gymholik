import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  getStepForField,
  formatGymCode,
} from './registrationValidation';

describe('Registration Form Zod Validation & Helpers', () => {
  describe('Step 1 Schema (Gym details)', () => {
    it('passes with valid gym name, type, owner name and optional email', () => {
      const valid = step1Schema.safeParse({
        gymName: 'Iron Peak Gym',
        gymType: 'COMMERCIAL',
        ownerName: 'Rajesh Sharma',
        email: 'rajesh@ironpeak.com',
      });
      assert.equal(valid.success, true);
    });

    it('passes without email', () => {
      const valid = step1Schema.safeParse({
        gymName: 'FitZone',
        gymType: 'BOUTIQUE_STUDIO',
        ownerName: 'Sneha Patel',
      });
      assert.equal(valid.success, true);
    });

    it('fails when gym name is less than 2 characters', () => {
      const res = step1Schema.safeParse({
        gymName: 'A',
        gymType: 'COMMERCIAL',
        ownerName: 'Sneha Patel',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('gymName')));
    });

    it('fails when gym type is not one of the 7 valid enum codes', () => {
      const res = step1Schema.safeParse({
        gymName: 'FitZone',
        gymType: 'INVALID_TYPE',
        ownerName: 'Sneha Patel',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('gymType')));
    });

    it('fails when owner name is missing or too short', () => {
      const res = step1Schema.safeParse({
        gymName: 'FitZone',
        gymType: 'COMMERCIAL',
        ownerName: ' ',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('ownerName')));
    });

    it('fails when email format is invalid', () => {
      const res = step1Schema.safeParse({
        gymName: 'FitZone',
        gymType: 'COMMERCIAL',
        ownerName: 'Sneha Patel',
        email: 'not-an-email',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('email')));
    });
  });

  describe('Step 2 Schema (Business registration - optional)', () => {
    it('passes when both legalIdType and legalIdNumber are empty (skipped)', () => {
      const res = step2Schema.safeParse({
        legalIdType: '',
        legalIdNumber: '',
      });
      assert.equal(res.success, true);
    });

    it('passes with valid UDYAM number', () => {
      const res = step2Schema.safeParse({
        legalIdType: 'UDYAM',
        legalIdNumber: 'UDYAM-MH-12-0012345',
      });
      assert.equal(res.success, true);
    });

    it('passes with valid GSTIN number', () => {
      const res = step2Schema.safeParse({
        legalIdType: 'GSTIN',
        legalIdNumber: '27AAPFU0939F1ZV',
      });
      assert.equal(res.success, true);
    });

    it('passes with valid NIC code', () => {
      const res = step2Schema.safeParse({
        legalIdType: 'NIC',
        legalIdNumber: '93110',
      });
      assert.equal(res.success, true);
    });

    it('fails when type is selected but number is empty', () => {
      const res = step2Schema.safeParse({
        legalIdType: 'GSTIN',
        legalIdNumber: '',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('legalIdNumber')));
    });

    it('fails when number is typed but type is not selected', () => {
      const res = step2Schema.safeParse({
        legalIdType: '',
        legalIdNumber: '27AAPFU0939F1ZV',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('legalIdType')));
    });

    it('fails when document number does not match format for the selected type', () => {
      const res = step2Schema.safeParse({
        legalIdType: 'GSTIN',
        legalIdNumber: 'INVALID_GSTIN',
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('legalIdNumber')));
    });
  });

  describe('Step 3 Schema (Gym address)', () => {
    it('passes with complete valid address and accepted terms', () => {
      const res = step3Schema.safeParse({
        addressLine1: 'Plot 42, Sector 18, Commercial Belt',
        addressLine2: 'Near Metro Station',
        state: 'Maharashtra',
        district: 'Pune',
        pincode: '411001',
        acceptedTerms: true,
      });
      assert.equal(res.success, true);
    });

    it('fails when address line 1 is less than 5 characters', () => {
      const res = step3Schema.safeParse({
        addressLine1: 'Main',
        state: 'Maharashtra',
        district: 'Pune',
        pincode: '411001',
        acceptedTerms: true,
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('addressLine1')));
    });

    it('fails when state is invalid', () => {
      const res = step3Schema.safeParse({
        addressLine1: 'Plot 42, Sector 18',
        state: 'Unknown State',
        district: 'Pune',
        pincode: '411001',
        acceptedTerms: true,
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('state')));
    });

    it('fails when pincode is not 6 digits or starts with 0', () => {
      const res1 = step3Schema.safeParse({
        addressLine1: 'Plot 42, Sector 18',
        state: 'Maharashtra',
        district: 'Pune',
        pincode: '011001',
        acceptedTerms: true,
      });
      assert.equal(res1.success, false);

      const res2 = step3Schema.safeParse({
        addressLine1: 'Plot 42, Sector 18',
        state: 'Maharashtra',
        district: 'Pune',
        pincode: '41100',
        acceptedTerms: true,
      });
      assert.equal(res2.success, false);
    });

    it('fails when acceptedTerms is false', () => {
      const res = step3Schema.safeParse({
        addressLine1: 'Plot 42, Sector 18',
        state: 'Maharashtra',
        district: 'Pune',
        pincode: '411001',
        acceptedTerms: false,
      });
      assert.equal(res.success, false);
      assert.ok(res.error?.issues.some((i) => i.path.includes('acceptedTerms')));
    });
  });

  describe('Helper Functions', () => {
    it('getStepForField maps field errors to appropriate form step', () => {
      assert.equal(getStepForField('gymName'), 1);
      assert.equal(getStepForField('gymType'), 1);
      assert.equal(getStepForField('ownerName'), 1);
      assert.equal(getStepForField('email'), 1);
      assert.equal(getStepForField('legalIdType'), 2);
      assert.equal(getStepForField('legalIdNumber'), 2);
      assert.equal(getStepForField('address.line1'), 3);
      assert.equal(getStepForField('address.state'), 3);
      assert.equal(getStepForField('address.pincode'), 3);
      assert.equal(getStepForField('pincode'), 3);
      assert.equal(getStepForField('district'), 3);
    });

    it('formatGymCode formats 8-character code as XXXX-XXXX', () => {
      assert.equal(formatGymCode('ABCD1234'), 'ABCD-1234');
      assert.equal(formatGymCode('23456789'), '2345-6789');
      assert.equal(formatGymCode('SHORT'), 'SHORT');
      assert.equal(formatGymCode(''), '');
      assert.equal(formatGymCode(null), '');
    });
  });
});
