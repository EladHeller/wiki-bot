import { WikiPage } from '../../types';
import { asyncGeneratorMapWithSequence, contentFromPage, convertContentToWikiPage } from '../../utilities';
import { IWikiApi } from '../../wiki/WikiApi';

type LanguageTemplate = {
  templateName: string;
  linkLabels: readonly string[];
};

export const LANGUAGE_TEMPLATES: Record<string, LanguageTemplate> = {
  uk: { templateName: 'אוק', linkLabels: ['אוק'] },
  it: { templateName: 'איט', linkLabels: ['איט'] },
  sq: { templateName: 'אלב', linkLabels: ['אלב'] },
  en: { templateName: 'אנ', linkLabels: ['אנ'] },
  et: { templateName: 'אסט', linkLabels: ['אסט'] },
  bg: { templateName: 'בול', linkLabels: ['בול'] },
  be: { templateName: 'בלא', linkLabels: ['בלא'] },
  ka: { templateName: 'גאו', linkLabels: ['גאו'] },
  de: { templateName: 'גר', linkLabels: ['גר'] },
  da: { templateName: 'דנ', linkLabels: ['דנ'] },
  hu: { templateName: 'הו', linkLabels: ['הו'] },
  nl: { templateName: 'הול', linkLabels: ['הול'] },
  tr: { templateName: 'טר', linkLabels: ['טר'] },
  el: { templateName: 'יוו', linkLabels: ['יוו'] },
  yi: { templateName: 'יי', linkLabels: ['יי'] },
  ja: { templateName: 'יפ', linkLabels: ['יפ'] },
  lv: { templateName: 'לטב', linkLabels: ['לטב'] },
  lt: { templateName: 'ליט', linkLabels: ['ליט'] },
  mk: { templateName: 'מק', linkLabels: ['מק'] },
  no: { templateName: 'נו', linkLabels: ['נו'] },
  zh: { templateName: 'סי', linkLabels: ['סי'] },
  es: { templateName: 'ספ', linkLabels: ['ספ'] },
  ar: { templateName: 'ער', linkLabels: ['ער'] },
  pt: { templateName: 'פור', linkLabels: ['פור'] },
  fi: { templateName: 'פי', linkLabels: ['פי'] },
  pl: { templateName: 'פל', linkLabels: ['פול', 'פל'] },
  fa: { templateName: "פר'", linkLabels: ['פר'] },
  cs: { templateName: "צ'כ", linkLabels: ['צכ', "צ'כ", 'צ׳כ'] },
  fr: { templateName: 'צר', linkLabels: ['צר'] },
  ko: { templateName: 'קו', linkLabels: ['קו'] },
  ru: { templateName: 'רו', linkLabels: ['רו'] },
  ro: { templateName: 'רומ', linkLabels: ['רומ'] },
  sv: { templateName: 'שוו', linkLabels: ['שוו'] },
};

const NON_WIKIPEDIA_PROJECT_PREFIXES = 'b|c|commons|d|dictionary|m|meta|mw|n|q|quote|s|source|species|v|voyage|wikibooks|wikidata|wikifunctions|wikimedia|wikinews|wikiquote|wikisource|wikiversity|wikivoyage|wiktionary';
const BASE_SEARCH_PATTERN = '\\<small\\>\\s*\\(\'*?\\s*\\[\\[:([a-zA-Z-]+):';
const SEARCH_PATTERN = `${BASE_SEARCH_PATTERN}(?!(?:${NON_WIKIPEDIA_PROJECT_PREFIXES}):)([^]|]+)\\|([a-zA-Zא-ת'׳ -]+)\\)?\\]\\]'*\\)?\\s*(\\((?:</small><small>)?\\d+(?:-\\d+)?(?:</small><small>)?\\d*(?:\\s*[,-–]\\s*\\d+)*\\))?\\s*((?:[.,;:)]|(?:{{ש}}))*)\\s*\\<\\/small\\>'*`;
const LINK_PATTERN = new RegExp(SEARCH_PATTERN.replaceAll('^]', '^\\]'), 'gi');
const SUMMARY = 'הסבת קישורים לוויקיפדיות זרות לתבניות שפה';

function normalizeLinkLabel(linkLabel: string): string {
  return linkLabel.trim().replace(/['׳]$/, '');
}

export function convertInterwikiLinksToTemplates(content: string): string {
  return content.replace(
    LINK_PATTERN,
    (text, languageCode: string, foreignTitle: string, linkLabel: string, year: string, punctuation: string) => {
      const normalizedLanguageCode = languageCode.toLowerCase();
      const normalizedLinkLabel = normalizeLinkLabel(linkLabel);
      const languageTemplate = LANGUAGE_TEMPLATES[normalizedLanguageCode];
      if (
        !languageTemplate
        || (!languageTemplate.linkLabels.includes(normalizedLinkLabel)
          && normalizedLinkLabel.toLowerCase() !== normalizedLanguageCode)
      ) {
        return text;
      }

      const normalizedForeignTitle = decodeURIComponent(foreignTitle.replace(/_/g, ' '));
      const normalizedYear = year ? ` <small>${year.replace('</small><small>', '')}</small>` : '';
      return `{{${languageTemplate.templateName}|${normalizedForeignTitle}}}${normalizedYear}${punctuation}`;
    },
  );
}

async function handlePage(api: IWikiApi, page: WikiPage): Promise<string | null> {
  const { content, revid } = contentFromPage(page);
  if (!content || !revid) {
    return null;
  }

  const newContent = convertInterwikiLinksToTemplates(content);
  if (newContent === content) {
    return null;
  }

  await api.edit(page.title, SUMMARY, newContent, revid);
  return page.title;
}

export async function checkPage(api: IWikiApi, title: string): Promise<void> {
  const { content, revid } = await api.articleContent(title);
  const page = convertContentToWikiPage(content, revid, title);
  await handlePage(api, page);
}

export default async function interwikiTemplateConverter(api: IWikiApi): Promise<void> {
  const generator = api.search(`insource:/${BASE_SEARCH_PATTERN}/`, false, '0|14|100');
  await asyncGeneratorMapWithSequence(
    1,
    generator,
    (page) => async () => handlePage(api, page),
  );
}
