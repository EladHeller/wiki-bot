export default function shabathProtectorDecorator(cb: (...args: any[]) => any) {
  return async function shabathProtector(...args: any[]) {
    const currentDateUTC = new Date(); // Lambda is in UTC
    const day = currentDateUTC.getDate();
    const hour = currentDateUTC.getHours();
    /**
       * The earliar Shabath starts in Israel, is about 16:00 on Friday in winter (14 because
       * Israel is GMT+2)
       * The latest Shabath ends is about 20:30 on Saturday in summer (17 becayse Israel is GMT+3
       * in summer)
       */
    const isShabathInIsrael = (day === 5 && hour >= 14) || (day === 6 && hour <= 17);
    if (isShabathInIsrael) {
      console.log('שבת היום להשם https://www.youtube.com/watch?v=oGZrUH88pnc');
      return undefined;
    }
    return cb(...args);
  };
}
