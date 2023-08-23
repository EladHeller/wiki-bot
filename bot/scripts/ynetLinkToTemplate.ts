import { GeneralLinkTemplateData } from './types';
import { linksToTemplates } from './utils';

// https://www.ynet.co.il/articles/0,7340,L-2918510,00.html
const articleRegex = /https?:\/\/www.ynet\.co\.il\/articles\/\d,\d+,\w-(\d+),\d+\.html/;
// https://www.ynet.co.il/digital/article/r1AIJ48pH
const generalRegex = /https?:\/\/www.ynet\.co\.il\/([^?]+)/;

function generalLinkConverter(generalLink: GeneralLinkTemplateData) {
  const url = generalLink['כתובת'];
  const match = url.match(articleRegex);
  const articleId = match?.[1] ?? url.match(generalRegex)?.[1] ?? '';
  if (!articleId) {
    return '';
  }
  const date = generalLink['תאריך'] ?? '';
  const otherData = generalLink['מידע נוסף'] ?? '';
  const otherWords = (otherData || date) ? `|${date}${(date && otherData) ? ', ' : ''}${otherData}` : '';
  return `{{ynet|${generalLink['הכותב'] ?? ''}|${generalLink['כותרת']}|${articleId}${otherWords}}}`;
}

export default async function ynetLinkToTemplate() {
  await linksToTemplates('ynet.co.il', {
    generalLinkConverter,
  });
}
