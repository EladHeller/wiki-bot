import { IWikiApi } from '../wiki/WikiApi';
import parseTableText, { buildTableWithStyle } from '../wiki/wikiTableParser';

interface SongData {
  title: string;
  artist: string;
  position: string;
}

interface WeeklyChartData {
  entries: SongData[];
  week: string;
}

interface IMediaForestBotModel {
  getMediaForestData(): Promise<WeeklyChartData>;
  updateChartTable(data: WeeklyChartData[]): Promise<void>;
  getOldData(start: number, end: number): Promise<WeeklyChartData[]>;
}

interface MediaForestConfig {
  baseUrl: string;
  page: string;
}

const lastWeekPath = 'שבוע אחרון';

async function getContent(wikiApi: IWikiApi, title: string) {
  const result = await wikiApi.articleContent(title);
  if (!result || !result.content) {
    throw new Error(`Missing content for ${title}`);
  }
  if (!result.revid) {
    throw new Error(`Missing revid for ${title}`);
  }

  return result;
}

export default function MediaForestBotModel(
  wikiApi: IWikiApi,
  config: MediaForestConfig,
  dataFetcher: (url: string) => Promise<any>,
): IMediaForestBotModel {
  const currentFullYear = new Date().getFullYear();

  function normalizeWeek(week: string) {
    return week.split(' ').splice(1).map((x) => x.replaceAll('-', '.')).join('-');
  }

  async function getMediaForestData(): Promise<WeeklyChartData> {
    let weeks: string[] | null = await dataFetcher(`${config.baseUrl}api/weekly_charts/weeks?year=${currentFullYear}`);
    if (!weeks || !weeks.length) {
      throw new Error('No data found');
    }
    const currentShortYear = currentFullYear % 100;
    weeks = weeks.filter((w: string) => w.endsWith(currentShortYear.toString()));
    const lastWeek = weeks.at(-1);
    if (!lastWeek) {
      throw new Error('No last week found');
    }
    const lastWeekText = normalizeWeek(lastWeek);
    const { content: weekContent, revid } = await getContent(wikiApi, `${config.page}/${lastWeekPath}`);
    if (weekContent === lastWeek) {
      console.log('No changes');
      return {
        entries: [],
        week: lastWeekText,
      };
    }

    const chart = await dataFetcher(`${config.baseUrl}weekly_charts/ISR/${currentFullYear}/${encodeURIComponent(lastWeek)}/RadioHe.json`);

    await wikiApi.edit(`${config.page}/${lastWeekPath}`, 'עדכון מדיה פורסט', lastWeek, revid);
    return {
      entries: chart.entries.map((entry: any) => ({
        title: entry.title,
        artist: entry.artist,
        position: entry.thisweek,
      })),
      week: lastWeekText,
    };
  }

  async function getOldData(start: number, end: number) {
    const data:WeeklyChartData[] = [];
    for (let year = start; year <= end; year += 1) {
      let weeks: string[] = await dataFetcher(`${config.baseUrl}api/weekly_charts/weeks?year=${year}`);
      if (!weeks || !weeks.length) {
        throw new Error('No data found');
      }
      weeks = weeks.filter((w: string) => w.endsWith((year % 100).toString()));
      for (const week of weeks) {
        const chart = await dataFetcher(`${config.baseUrl}weekly_charts/ISR/${year}/${encodeURIComponent(week)}/RadioHe.json`);
        const weekText = normalizeWeek(week);

        data.push({
          week: weekText,
          entries: chart.entries.map((entry: any) => ({
            title: entry.title,
            artist: entry.artist,
            position: entry.thisweek,
          })),
        });
      }
    }
    return data;
  }

  async function updateChartTable(weeklyCharts: WeeklyChartData[]) {
    const { content, revid } = await getContent(wikiApi, config.page);

    const tablesData = parseTableText(content);
    if (tablesData.length !== 1) {
      throw new Error('Table not found');
    }
    const tableData = tablesData[0];
    for (const weeklyChart of weeklyCharts) {
      tableData.rows.push({
        fields: [weeklyChart.week, ...weeklyChart.entries.map((d) => `"${d.title}" - (${d.artist})`)],
      });
    }

    const newTableText = buildTableWithStyle(
      tableData.rows[0].fields.map((f) => f.toString().trim()),
      tableData.rows.slice(1),
      false,
    );
    const newContent = content.replace(tableData.text, newTableText);
    await wikiApi.edit(config.page, 'עדכון מדיה פורסט', newContent, revid);
  }
  return {
    getMediaForestData,
    updateChartTable,
    getOldData,
  };
}
