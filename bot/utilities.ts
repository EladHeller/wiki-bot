const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';
export type CurrencyCode = 'USD' | 'NIS' | 'EUR' | 'ILS' | 'JPY' | 'AUD' | 'INR' | 'HKD' | 'CNY' | 'IDR' | 'CAD' | 'DKK' | 'KRW' | 'GBP';

export const currencyName: Record<CurrencyCode, string> = {
  EUR: 'אירו',
  NIS: 'ש"ח',
  USD: 'דולר אמריקאי|דולר',
  ILS: 'ש"ח',
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
    sumStr = number.substring(0, 3);
    const remind = number.length % 3;
    if (remind) {
      sumStr = [sumStr.slice(0, remind), '.', sumStr.slice(remind)].join('');
    }
  } else {
    orderOfMagmitude = milliardStr;
    sumStr = Number(number.substring(0, number.length - 6)).toLocaleString();
  }

  return `${sumStr}${orderOfMagmitude ? ` [[${orderOfMagmitude}]]` : ''} [[${currencyName[currencyCode]}]]`;
}

export function getLocalDate(dateString:string): string {
  const date = new Date(dateString);
  return `${date.toLocaleString('he', { month: 'long', day: 'numeric' })} ${new Date(date).getFullYear()}`;
}

export async function promiseSequence(size: number, callbacks: Array<() => Promise<any>>) {
  let batch = callbacks.splice(0, size);

  while (batch.length > 0) {
    await Promise.all(batch.map((callback) => callback()));
    batch = callbacks.splice(0, 10);
  }
}

export function objectToFormData(obj: Record<string, any>) {
  const fd = new URLSearchParams();
  Object.entries(obj).forEach(([key, val]) => fd.append(key, val));
  return fd;
}

export function objectToQueryString(obj: Record<string, any>): string {
  return Object.entries(obj).map(([key, val]) => `${key}=${val}`).join('&');
}
