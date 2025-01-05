import { IWikiApi } from '../wiki/NewWikiApi';
import parseTableText, { buildTableWithStyle } from '../wiki/wikiTableParser';

interface SongData {
  title: string;
  artist: string;
  position: string;
}

interface IMediaForestBotModel {
  getMediaForestData(): Promise<SongData[]>;
  updateChartTable(data: SongData[]): Promise<void>;
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
  async function getMediaForestData() {
    const weeks = await dataFetcher(`${config.baseUrl}api/weekly_charts/weeks?year=${currentYear}`);
    if (!weeks || !weeks.length) {
      throw new Error('No data found');
    }
    const lastWeek = weeks[0];
    const { content: weekContent, revid } = await getContent(wikiApi, `${config.page}/${lastWeekPath}`);
    if (weekContent === lastWeek) {
      console.log('No changes');
      return [];
    }

    const chart = await dataFetcher(`${config.baseUrl}weekly_charts/ISR/${currentYear}/${encodeURIComponent(lastWeek)}/RadioHe.json`);

    await wikiApi.edit(`${config.page}/${lastWeekPath}`, 'עדכון מדיה פורסט', lastWeek, revid);
    return chart.entries.map((entry: any) => ({
      title: entry.title,
      artist: entry.artist,
      position: entry.thisweek,
    }));
  }

  async function updateChartTable(data: SongData[]) {
    const { content, revid } = await getContent(wikiApi, config.page);

    const tablesData = parseTableText(content);
    if (tablesData.length !== 1) {
      throw new Error('Table not found');
    }
    const tableData = tablesData[0];
    const today = new Date();
    const daysToWeekend = 6 - today.getDay();
    const weekRangeEndDate = new Date(today);
    weekRangeEndDate.setDate(today.getDate() + daysToWeekend);
    const weekRangeStartDate = new Date(weekRangeEndDate);
    weekRangeStartDate.setDate(weekRangeStartDate.getDate() - 6);
    const weekRangeText = `${weekRangeStartDate.getDate()}.${weekRangeStartDate.getMonth() + 1}.${weekRangeStartDate.getFullYear().toString().slice(2)}-${weekRangeEndDate.getDate()}.${weekRangeEndDate.getMonth() + 1}.${weekRangeEndDate.getFullYear().toString().slice(2)}`;
    tableData.rows.push({
      fields: [weekRangeText, ...data.map((d) => `"${d.title}" - (${d.artist})`)],
    });

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
  };
}
