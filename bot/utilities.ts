const thousandStr = '1000 (מספר)|אלף';
const millionStr = 'מיליון';
const milliardStr = 'מיליארד';
const NIS = 'ש"ח';

export function prettyNumericValue(number: string): string {
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

  return `${sumStr}${orderOfMagmitude ? ` [[${orderOfMagmitude}]]` : ''} [[${NIS}]]`;
}

export default {
  prettyNumericValue,
};
