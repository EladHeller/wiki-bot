/* eslint-disable jest/prefer-expect-assertions */
import { getLocalDate, parseLocalDate, prettyNumericValue } from '../utilities';

describe('prettyNumericValue', () => {
  it('should return 0 for zero', () => {
    const result = prettyNumericValue('0');

    expect(result).toBe('0 [[שקל חדש|ש"ח]]');
  });

  it('should return thousands as well', () => {
    const result = prettyNumericValue('5');

    expect(result).toBe('5 [[1000 (מספר)|אלף]] [[שקל חדש|ש"ח]]');
  });

  it('should return hundred thousands as well', () => {
    const result = prettyNumericValue('324');

    expect(result).toBe('324 [[1000 (מספר)|אלף]] [[שקל חדש|ש"ח]]');
  });

  it('should return millions as well', () => {
    const result = prettyNumericValue('2000');

    expect(result).toBe('2.00 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return millions with thosands as well', () => {
    const result = prettyNumericValue('2520');

    expect(result).toBe('2.52 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return dezens millions with thosands as well', () => {
    const result = prettyNumericValue('23520');

    expect(result).toBe('23.5 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return hundreds millions as well', () => {
    const result = prettyNumericValue('123520');

    expect(result).toBe('123 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return milliards as well', () => {
    const result = prettyNumericValue('1123520');

    expect(result).toBe('1.12 [[מיליארד]] [[שקל חדש|ש"ח]]');
  });

  it('should return dolar for dolar values', () => {
    const result = prettyNumericValue('51123520', 'USD');

    expect(result).toBe('51.1 [[מיליארד]] [[דולר אמריקאי|דולר]]');
  });

  it('should return euro for euro values', () => {
    const result = prettyNumericValue('132123520', 'EUR');

    expect(result).toBe('132 [[מיליארד]] [[אירו]]');
  });
});

describe('getLocalDate', () => {
  it('should get local date', () => {
    const localDate = getLocalDate('2027-01-13');

    expect(localDate).toBe('13 בינואר 2027');
  });
});

describe('parseLocalDate', () => {
  it('should parse local date', () => {
    const date = parseLocalDate('13 בינואר 2027');

    expect(date).toStrictEqual(new Date('2027-01-13'));
  });
});
