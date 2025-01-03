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
    url: string;
    page: string;
}

const defaultConfig: MediaForestConfig = {
  url: 'https://mediaforest-group.com/weekly_charts.html',
  page: 'ויקיפדיה:בוט/בוט מצעדים/מדיה פורסט',
};

export default function MediaForestBotModel(
  wikiApi: IWikiApi,
  config: MediaForestConfig = defaultConfig,
): IMediaForestBotModel {
  async function getMediaForestData() {
    const result = await JSDOM.fromURL(config.url);
    const { document } = result.window;
    const table = document.querySelector('table');
    if (!table) {
      throw new Error('Table not found');
    }
    const rows = table.querySelectorAll('tr');
    const data: SongData[] = [];
    for (const row of rows) {
      const position = row.querySelector('td:nth-child(1)')?.textContent?.trim();
      const cell = row.querySelector('td:nth-child(3)');
      const artist = cell?.querySelector('b')?.textContent?.trim();
      const title = cell?.querySelector('span')?.textContent?.trim();
      if (!position || !artist || !title) {
        throw new Error('Data not found in cell');
      }
      data.push({
        title,
        artist,
        position,
      });
    }
    return data;
  }

  async function updateChartTable(data: SongData[]) {
    const articleContent = await wikiApi.articleContent(config.page);
    if (!articleContent || !articleContent.content) {
      throw new Error('Article content not found');
    }
    if (!articleContent.revid) {
      throw new Error('Article revid not found');
    }
    const { content, revid } = articleContent;

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
      tableData.rows[0].fields.map((f) => f.toString()),
      tableData.rows.slice(1),
      false,
    );
    const newContent = content.replace(tableData.text, newTableText);
    if (newContent === content) {
      console.log('No changes');
      return;
    }
    await wikiApi.edit(config.page, 'עדכון מדיה פורסט', newContent, revid);
  }
  return {
    getMediaForestData,
    updateChartTable,
  };
}
