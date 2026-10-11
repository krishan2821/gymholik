import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { updateGymProfileSchema } from './gymProfileValidation';

describe('gymProfileValidation', () => {
  const validData = {
    name: 'Iron Forge Fitness',
    gymType: 'COMMERCIAL',
    legalIdType: 'GSTIN',
    legalIdNumber: '27AAPFU0939F1ZV',
    line1: '123 Ring Road, South Ext',
    line2: 'Near Metro Gate 2',
    state: 'Delhi',
    district: 'South Delhi',
    pincode: '110049',
  };

  it('passes validation for completely valid gym profile update', () => {
    const result = updateGymProfileSchema.safeParse(validData);
    assert.equal(result.success, true);
  });

  it('passes validation without optional legal id', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      legalIdType: null,
      legalIdNumber: null,
    });
    assert.equal(result.success, true);
  });

  it('fails if gym name is less than 2 characters', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      name: 'A',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'name'));
    }
  });

  it('fails if gym type is invalid', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      gymType: 'INVALID_TYPE',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'gymType'));
    }
  });

  it('fails if legal doc type is provided without number', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      legalIdType: 'GSTIN',
      legalIdNumber: '',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'legalIdNumber'));
    }
  });

  it('fails if legal doc number is invalid format', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      legalIdType: 'GSTIN',
      legalIdNumber: 'INVALID_GSTIN_123',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'legalIdNumber'));
    }
  });

  it('fails if address line 1 is less than 5 characters', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      line1: '123',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'line1'));
    }
  });

  it('fails if state is invalid', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      state: 'Not A Real Indian State',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'state'));
    }
  });

  it('fails if pincode is invalid', () => {
    const result = updateGymProfileSchema.safeParse({
      ...validData,
      pincode: '012345',
    });
    assert.equal(result.success, false);
    if (!result.success) {
      assert.ok(result.error.issues.some((i) => i.path[0] === 'pincode'));
    }
  });
});
