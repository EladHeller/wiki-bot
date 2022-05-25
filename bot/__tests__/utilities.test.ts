/* eslint-disable jest/prefer-expect-assertions */
import { prettyNumericValue } from '../utilities';

describe('prettyNumericValue', () => {
  it('should return 0 for zero', () => {
    const result = prettyNumericValue('0');

    expect(result).toBe('0 [[ש"ח]]');
  });

  it('should return thousands as well', () => {
    const result = prettyNumericValue('5');

    expect(result).toBe('5 [[1000 (מספר)|אלף]] [[ש"ח]]');
  });

  it('should return hundred thousands as well', () => {
    const result = prettyNumericValue('324');

    expect(result).toBe('324 [[1000 (מספר)|אלף]] [[ש"ח]]');
  });

  it('should return millions as well', () => {
    const result = prettyNumericValue('2000');

    expect(result).toBe('2.00 [[מיליון]] [[ש"ח]]');
  });

  it('should return millions with thosands as well', () => {
    const result = prettyNumericValue('2520');

    expect(result).toBe('2.52 [[מיליון]] [[ש"ח]]');
  });

  it('should return dezens millions with thosands as well', () => {
    const result = prettyNumericValue('23520');

    expect(result).toBe('23.5 [[מיליון]] [[ש"ח]]');
  });

  it('should return hundreds millions as well', () => {
    const result = prettyNumericValue('123520');

    expect(result).toBe('123 [[מיליון]] [[ש"ח]]');
  });

  it('should return milliards as well', () => {
    const result = prettyNumericValue('1123520');

    expect(result).toBe('1.12 [[מיליארד]] [[ש"ח]]');
  });
});
