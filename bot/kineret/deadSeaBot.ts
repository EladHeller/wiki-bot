import {
  formatDate, updateLevel,
} from './utils';

const apiUrl = 'https://data.gov.il/api/3/action/datastore_search?resource_id=823479b4-4771-43d8-9189-6a2a1dcaaf10&limit=1';

interface DeadSeaLevelRecord {
    'תאריך מדידה': string;
    'מפלס' : string;
    _id: number;
}

const articleName = 'ים המלח';

const dataSource = '{{הערה|[https://data.gov.il/dataset/https-www-data-gov-il-dataset-683/resource/823479b4-4771-43d8-9189-6a2a1dcaaf10 מפלס ים המלח משנת 1976], אתר [[ממשל_זמין#אתר_Gov.il|מאגרי המידע הממשלתיים]]}}';
const DATE_REGEX = /(\d{2})\/(\d{2})\/(\d{4})/;

async function getDeadSeaLevel() {
  const levelRes = await fetch(apiUrl).then((res) => res.json());
  const record: DeadSeaLevelRecord = levelRes.result.records[0];
  const date = record['תאריך מדידה'].match(DATE_REGEX);
  if (!date) {
    throw new Error('Failed to get dead sea level');
  }
  const [, day, month, year] = date;
  const dateFormat = formatDate(new Date(`${year}-${month}-${day}`));
  return {
    date: dateFormat,
    level: record['מפלס'],
  };
}

export default async function updateDeadSeaLevel() {
  const { date, level } = await getDeadSeaLevel();

  await updateLevel({ date, level }, articleName, dataSource);
}
