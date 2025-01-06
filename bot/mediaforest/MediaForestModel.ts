import { IWikiApi } from '../wiki/NewWikiApi';
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
  const currentYear = new Date().getFullYear();

  function normalizeWeek(week: string) {
    return week.split(' ').splice(1).map((x) => x.replaceAll('-', '.')).join('-');
  }

  async function getMediaForestData(): Promise<WeeklyChartData> {
    const weeks = await dataFetcher(`${config.baseUrl}api/weekly_charts/weeks?year=${currentYear}`);
    if (!weeks || !weeks.length) {
      throw new Error('No data found');
    }
    const lastWeek = weeks[0];
    const lastWeekText = normalizeWeek(lastWeek);
    const { content: weekContent, revid } = await getContent(wikiApi, `${config.page}/${lastWeekPath}`);
    if (weekContent === lastWeek) {
      console.log('No changes');
      return {
        entries: [],
        week: lastWeekText,
      };
    }

    const chart = await dataFetcher(`${config.baseUrl}weekly_charts/ISR/${currentYear}/${encodeURIComponent(lastWeek)}/RadioHe.json`);

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
      const weeks: string[] = await dataFetcher(`${config.baseUrl}api/weekly_charts/weeks?year=${year}`);
      if (!weeks || !weeks.length) {
        throw new Error('No data found');
      }
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
