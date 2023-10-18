/* eslint-disable jest/no-conditional-in-test */
import {
  asyncGeneratorMapWithSequence, getFullYear, getLocalDate, objectToFormData, objectToQueryString,
  parseLocalDate, prettyNumericValue, promiseSequence,
} from '../utilities';

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

  it('should round dezens millions with thosands as well', () => {
    const result = prettyNumericValue('23560');

    expect(result).toBe('23.6 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return hundreds millions as well', () => {
    const result = prettyNumericValue('123520');

    expect(result).toBe('124 [[מיליון]] [[שקל חדש|ש"ח]]');
  });

  it('should return milliards as well', () => {
    const result = prettyNumericValue('1123520');

    expect(result).toBe('1.12 [[מיליארד]] [[שקל חדש|ש"ח]]');
  });

  it('should return trillion as milliards', () => {
    const result = prettyNumericValue('1123520000');

    expect(result).toBe('1,124 [[מיליארד]] [[שקל חדש|ש"ח]]');
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

  it('should return empty string for invalid date', () => {
    const localDate = getLocalDate('2027-01-32');

    expect(localDate).toBe('');
  });
});

describe('getFullYear', () => {
  it('should return full year for 2 digits year', () => {
    const year = getFullYear('12');

    expect(year).toBe('2012');
  });

  it('should return full year for 4 digits year', () => {
    const year = getFullYear('2027');

    expect(year).toBe('2027');
  });

  it('should return 19xx for 2 digits year > 25', () => {
    const year = getFullYear('26');

    expect(year).toBe('1926');
  });

  it('should return 20xx for 2 digits year <= 25', () => {
    const year = getFullYear('25');

    expect(year).toBe('2025');
  });
});

describe('parseLocalDate', () => {
  it('should parse local date', () => {
    const date = parseLocalDate('13 בינואר 2027');

    expect(date).toStrictEqual(new Date('2027-01-13'));
  });

  it('should return invalid date if false passed in throwError parameter', () => {
    const date = parseLocalDate('12 בספטמבר', false);

    expect(+date).toBeNaN();
  });

  it('should throw error if invalid date passed', () => {
    expect(() => parseLocalDate('12 בספטמבר')).toThrow('Invalid date');
  });
});

describe('promiseSequence', () => {
  it('should run promises in sequence', async () => {
    const results: number[] = [];
    const promises = [5, 4, 3, 2, 1].map((num) => async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, num);
      });
      results.push(num);
    });

    await promiseSequence(2, promises);

    expect(results).toStrictEqual([4, 5, 2, 3, 1]);
  });

  it('should run promises in sequence with error', async () => {
    const results: number[] = [];
    const promises = [5, 4, 3, 2, 1].map((num) => async () => {
      await new Promise((resolve, reject) => {
        if (num === 3) {
          reject('Error'); // eslint-disable-line prefer-promise-reject-errors
        }
        setTimeout(resolve, num);
      });

      results.push(num);
    });

    await promiseSequence(2, promises);

    expect(results).toStrictEqual([4, 5, 2, 1]);
  });
});

describe('objectToFormData', () => {
  it('should convert object to form data', () => {
    const formData = objectToFormData({
      a: 'b',
      c: 'd',
    });

    expect(formData.toString()).toBe('a=b&c=d');
  });
});

describe('objectToQueryString', () => {
  it('should convert object to query string', () => {
    const queryString = objectToQueryString({
      a: 'b',
      c: 'd',
    });

    expect(queryString).toBe('a=b&c=d');
  });
});

describe('asyncGeneratorMapWithSequence', () => {
  it('should run generator and map with sequence', async () => {
    async function* generatorFunc() {
      yield Promise.resolve([3, 2, 1]);
      yield Promise.resolve([6, 5, 4]);
      yield Promise.resolve([9, 8, 7]);
    }

    const generator = generatorFunc();

    const results: number[] = [];
    await asyncGeneratorMapWithSequence(2, generator, (num) => async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, num);
      });
      results.push(num);
    });

    expect(results).toStrictEqual([2, 3, 1, 5, 6, 4, 8, 9, 7]);
  });

  it('should run generator and map with sequence with error', async () => {
    global.continueObject = '456';
    async function* generatorFunc() {
      yield Promise.resolve([3, 2, 1]);
      if (global.continueObject !== '123') {
        throw new Error('Error');
      }
      yield Promise.resolve([6, 5, 4]);
      yield Promise.resolve([9, 8, 7]);
    }

    const generator = generatorFunc();

    const results: number[] = [];
    await asyncGeneratorMapWithSequence(2, generator, (num) => async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, num);
      });
      results.push(num);
    });

    expect(results).toStrictEqual([2, 3, 1]);
  });

  it('should run generator and map with sequence with error, evene continue object is empty', async () => {
    global.continueObject = undefined;
    async function* generatorFunc() {
      yield Promise.resolve([3, 2, 1]);
      yield Promise.resolve([6, 5, 4]);
      if (global.continueObject !== '123') {
        throw 'asdasd'; // eslint-disable-line no-throw-literal
      }
      yield Promise.resolve([9, 8, 7]);
    }

    const generator = generatorFunc();

    const results: number[] = [];
    await asyncGeneratorMapWithSequence(2, generator, (num) => async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, num);
      });
      results.push(num);
    });

    expect(results).toStrictEqual([2, 3, 1, 5, 6, 4]);
  });
});
