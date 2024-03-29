/* eslint-disable no-bitwise */
const {
  HDate, HebrewCalendar, Zmanim, flags, Location,
} = require('@hebcal/core');

const JERUSALEM_LATITUDE = 31.7784;
const JERUSALEM_LONGITUDE = 35.2354;

export function isAfterShabathOrHolliday() {
  const jerusalemGeo = new Location(JERUSALEM_LATITUDE, JERUSALEM_LONGITUDE, true, 'Asia/Jerusalem');
  const now = new Date();
  const zman = new Zmanim(jerusalemGeo, now);
  // 60 minutes after sunset to be on the safe side
  const isBeforeEnd = now < zman.sunsetOffset(60);
  const day = new HDate(new Date(now));
  const holidays = HebrewCalendar.getHolidaysOnDate(day, true);
  const dayNumber = day.getDay();

  const isAfterShabathInIsrael = (dayNumber === 6 && !isBeforeEnd);

  let isAfterYomTovInIsrael = false;
  holidays?.forEach((holiday) => {
    if (((holiday.mask & flags.CHAG) && !isBeforeEnd)) {
      isAfterYomTovInIsrael = true;
    }
  });
  return isAfterShabathInIsrael || isAfterYomTovInIsrael;
}

export default function shabathProtectorDecorator(cb: (...args: any[]) => any) {
  return async function shabathProtector(...args: any[]) {
    const jerusalemGeo = new Location(JERUSALEM_LATITUDE, JERUSALEM_LONGITUDE, true, 'Asia/Jerusalem');
    const now = new Date();
    const zman = new Zmanim(jerusalemGeo, now);
    // 60 minutes before sunset to be on the safe side
    const isAfterStart = now > zman.sunsetOffset(-60);
    // 60 minutes after sunset to be on the safe side
    const isBeforeEnd = now < zman.sunsetOffset(60);
    const day = new HDate(new Date(now));
    const holidays = HebrewCalendar.getHolidaysOnDate(day, true);
    const tomorowHolidays = HebrewCalendar.getHolidaysOnDate(day.add(1, 'd'), true);
    const dayNumber = day.getDay();

    const isShabathInIsrael = (dayNumber === 5 && isAfterStart)
       || (dayNumber === 6 && isBeforeEnd);

    let isYomTovInIsrael = false;
    holidays?.forEach((holiday) => {
      if (((holiday.mask & flags.CHAG) && isBeforeEnd)) {
        isYomTovInIsrael = true;
      }
    });
    tomorowHolidays?.forEach((tomorowHoliday) => {
      if (((tomorowHoliday.mask & flags.CHAG) && isAfterStart)) {
        isYomTovInIsrael = true;
      }
    });
    if (isShabathInIsrael) {
      console.log('שבת היום להשם https://www.youtube.com/watch?v=oGZrUH88pnc');
      return undefined;
    }
    if (isYomTovInIsrael) {
      console.log('גוט יום טוב https://www.youtube.com/watch?v=oGZrUH88pnc');
      return undefined;
    }
    return cb(...args);
  };
}
