import { getFullYear, getLocalDate } from '../utilities';

/* eslint-disable max-len */
export default function formalizedDateFormat(date: string, pageTitle: string): string | null {
  const formatWithAdditions = date.match(/^[הב]?\[?\[?(\d{1,2})[בן,]?\s?ב?\[?\[?([א-ת]{3,9})\]?\]?,?\s?(?:''')?\[?\[?(\d{4})\]?\]?(?:''')?[.,]?$/);
  if (formatWithAdditions) {
    return `${formatWithAdditions[1]} ב${formatWithAdditions[2]} ${formatWithAdditions[3]}`;
  }

  const reverseDate = date.match(/^\s*([א-ת]{3,9}) (\d{1,2}),? ?(\d{4})/);
  if (reverseDate) {
    const newDate = `${reverseDate[2]} ב${reverseDate[1]} ${reverseDate[3]}`;
    console.log('reverse date', date);
    return newDate;
  }

  const shortYearMatch = date.match(/^(\d{1,2} ב[א-ת]{3,9}),? (\d{2})$/);
  if (shortYearMatch) {
    console.log('ShortYear', date);
    return `${shortYearMatch[1]} ${getFullYear(shortYearMatch[2])}`;
  }

  let dateFormatMatch = date.match(
    /^\s*\(?(?:\d{2}:\d{2}\s*,\s*)?(?<day>[0-3]?[0-9])[ \\/,.-](?<month>[01]?[0-9])[ \\/,.-](?<year>\d{2,4})[ /,.-]?(?:\s*,?\s*\d{2}:\d{2})?\)?\s*$/, // 01/02/03
  );
  if (!dateFormatMatch) {
    dateFormatMatch = date.match(/^\s*(?<year>\d{4})[ /,.-](?<month>[01]?[0-9])[ /,.-](?<day>[0-3]?[0-9])\s*$/); // 2003/01/02
  }
  const { day, month, year } = dateFormatMatch?.groups ?? {};
  if (!dateFormatMatch || !day || !month || !year) {
    console.log('Invalid date', `* [[${pageTitle}]]: ${date}`);
    return null;
  }
  const fullYear = getFullYear(year);
  const localDate = getLocalDate(`${fullYear}-${month}-${day}`);
  if (!localDate) {
    console.log('Invalid local date', `* [[${pageTitle}]]: ${date}`);
    return null;
  }
  return localDate;
}
