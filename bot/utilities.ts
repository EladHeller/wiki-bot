const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';
export type CurrencyCode = 'USD' | 'NIS' | 'EUR' | 'ILS' | 'JPY' | 'AUD' | 'INR' | 'HKD' | 'CNY' | 'IDR' | 'CAD' | 'DKK' | 'KRW' | 'GBP';

export const currencyName: Record<CurrencyCode, string> = {
  EUR: 'אירו',
  NIS: 'שקל חדש|ש"ח',
  USD: 'דולר אמריקאי|דולר',
  ILS: 'שקל חדש|ש"ח',
  JPY: 'ין יפני',
  AUD: 'דולר אוסטרלי',
  INR: 'רופי הודי',
  HKD: 'דולר הונג קונגי',
  CNY: 'רנמינבי',
  IDR: 'רוּפּיה אינדונזית',
  CAD: 'דולר קנדי',
  DKK: 'כתר דני',
  KRW: 'וון דרום קוריאני',
  GBP: 'לירה שטרלינג',
};

export function prettyNumericValue(number: string, currencyCode: CurrencyCode = 'NIS'): string {
  let orderOfMagmitude = '';
  let sumStr = '';
  if (number === '0') {
    sumStr = number;
  } else if (number.length < 4) {
    orderOfMagmitude = thousandStr;
    sumStr = number;
  } else if (number.length < 10) {
    orderOfMagmitude = number.length < 7 ? millionStr : milliardStr;
    sumStr = Math.round(Number(number.substring(0, 4)) / 10).toString();
    const remind = number.length % 3;
    if (remind) {
      sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('');
    }
  } else {
    orderOfMagmitude = milliardStr;
    sumStr = Math.round(Number(number.substring(0, number.length - 5)) / 10).toLocaleString();
  }

  return `${sumStr}${orderOfMagmitude ? ` [[${orderOfMagmitude}]]` : ''} [[${currencyName[currencyCode]}]]`;
}

export function getLocalDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(+date)) {
    return '';
  }
  return `${date.toLocaleString('he', { month: 'long', day: 'numeric' })} ${date.getFullYear()}`;
}

export function getFullYear(year: string): string {
  if (year.length === 2) {
    const yearNumber = +year;
    if (yearNumber > 25) {
      return `19${year}`;
    }
    return `20${year}`;
  }
  return year;
}

const monthToNumber: Record<string, string> = {
  ינואר: '01',
  פברואר: '02',
  מרץ: '03',
  אפריל: '04',
  מאי: '05',
  יוני: '06',
  יולי: '07',
  אוגוסט: '08',
  ספטמבר: '09',
  אוקטובר: '10',
  נובמבר: '11',
  דצמבר: '12',
};

export function parseLocalDate(dateString:string, throwError = true): Date {
  const [day, month, year] = dateString.split(' ');
  if (!day || !month || !year) {
    if (throwError) {
      throw new Error('Invalid date');
    }
    return new Date('Error date');
  }
  const monthNumber = monthToNumber[month.replace('ב', '')];
  return new Date(`${year}-${monthNumber}-${day.padStart(2, '0')}`);
}

export async function promiseSequence<T>(size: number, callbacks: Array<() => Promise<T>>): Promise<Array<T>> {
  let batch = callbacks.splice(0, size);
  const results: T[] = [];

  while (batch.length > 0) {
    await Promise.all(batch.map(async (callback) => {
      try {
        const res = await callback();
        results.push(res);
      } catch (error) {
        console.log(error?.data || error?.message || error?.toString());
      }
    }));
    batch = callbacks.splice(0, size);
  }
  return results;
}

export function objectToFormData(obj: Record<string, any>) {
  const fd = new URLSearchParams();
  Object.entries(obj).forEach(([key, val]) => fd.append(key, val));
  return fd;
}

export function objectToQueryString(obj: Record<string, any>): string {
  return Object.entries(obj).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');
}

export async function asyncGeneratorMapWithSequence<T, R = any>(
  sequenceSize: number,
  generator: AsyncGenerator<T[], void, void>,
  callback: (value: T) => () => Promise<R>,
): Promise<Array<R | void>> {
  let res: IteratorResult<T[], void> = { done: false, value: [] };
  const results: Array<R | void> = [];
  do {
    try {
      res = await generator.next();
      if (res.value) {
        results.push(...await promiseSequence(sequenceSize, res.value.map(callback)));
      }
    } catch (error) {
      console.log(error?.data || error?.message || error?.toString());
      if (global.continueObject) {
        console.log('continue', global.continueObject);
      }
    }
  } while (!res.done);

  return results;
}
