import osimhistoriaLinks from './osimhistoria.json';
import WikiApi from '../../wiki/WikiApi';
import { asyncGeneratorMapWithSequence } from '../../utilities';
import { findTemplates, getTemplateData, templateFromTemplateData } from '../../wiki/newTemplateParser';
import { WikiPage } from '../../types';

const OLD_TEMPLATE_NAME = 'עושים היסטוריה';
const NEW_TEMPLATE_NAME = 'עושים היסטוריה1';
const HOST_NAME = 'רן לוי';
const SUMMARY = 'הסבת {{עושים היסטוריה}} ל-{{עושים היסטוריה1}}';
const DRY_RUN = false;

function normalizeText(value: string): string {
  return value.trim().replace(/^https?:\/\/(www\.)?osimhistoria\.com\//, '').replace(/[?#].*$/, '').replace(/^\/+|\/+$/g, '');
}

function extractPodcastSlug(url: string): string | null {
  const normalized = normalizeText(url);
  if (!normalized.startsWith('podcast/')) {
    return null;
  }

  const slug = normalized.replace(/^podcast\//, '').replace(/^\/+|\/+$/g, '');
  return slug || null;
}

function getNumericEpisode(value: string): number | null {
  if (value.match(/^\d{3}$/)) {
    return Number(value);
  }
  const directDigits = value.match(/^\D*?(\d{3})\D+$/);
  if (directDigits) {
    return Number(directDigits[1]);
  }

  const ohEp = value.match(/(?:^|\/)oh_ep_(\d+)/i);
  if (ohEp) {
    return Number(ohEp[1]);
  }

  const ep = value.match(/(?:^|[-_/])ep(?:isode)?[_-]?(\d+)/i);
  if (ep) {
    return Number(ep[1]);
  }

  const leadingDigits = value.match(/^(\d+)[-_/]/);
  if (leadingDigits) {
    return Number(leadingDigits[1]);
  }

  return null;
}

function buildEpisodeMaps(links: string[]) {
  const byNumber = new Map<number, string>();
  const bySlug = new Map<string, string>();

  links.forEach((url) => {
    const slug = extractPodcastSlug(url);
    if (!slug) {
      return;
    }

    bySlug.set(slug, slug);

    const numeric = getNumericEpisode(slug);
    if (numeric && !byNumber.has(numeric)) {
      byNumber.set(numeric, slug);
    }
  });

  return { byNumber, bySlug };
}

function collapseOsimhistoriaPrefix(id: string): string {
  return id.replace(/^osimhistoria\/?/i, '');
}

function resolveNewTemplateEpisodeId(
  rawEpisodeId: string,
  byNumber: Map<number, string>,
  bySlug: Map<string, string>,
): string | null {
  const normalized = collapseOsimhistoriaPrefix(normalizeText(rawEpisodeId));
  const numeric = getNumericEpisode(normalized);
  if (numeric) {
    const slug = byNumber.get(numeric);
    if (slug) {
      return slug.match(/^\d{3}-/) ? String(numeric) : slug;
    }
  }

  const slugCandidate = normalized.replace(/^podcast\//, '');
  if (bySlug.has(slugCandidate)) {
    return slugCandidate.match(/^\d+/) ? String(getNumericEpisode(slugCandidate)) : slugCandidate;
  }

  return null;
}

function processTemplate(
  template: string,
  title: string,
  byNumber: Map<number, string>,
  bySlug: Map<string, string>,
): { newTemplate: string | null; reason?: string } {
  const templateData = getTemplateData(template, OLD_TEMPLATE_NAME, title);
  const oldArray = templateData.arrayData ?? [];
  const keyValueData = templateData.keyValueData ?? {};

  const episodeTitle = oldArray[0];
  const oldEpisodeId = oldArray[1];
  const extraInfo = oldArray[2];
  const isTextOnly = keyValueData['פודקאסט'] === 'לא';

  if (isTextOnly) {
    return { newTemplate: null, reason: 'פודקאסט=לא' };
  }
  if (!episodeTitle || !oldEpisodeId) {
    return { newTemplate: null, reason: 'missing title or episode id' };
  }

  const newEpisodeId = resolveNewTemplateEpisodeId(oldEpisodeId, byNumber, bySlug);
  if (!newEpisodeId) {
    return { newTemplate: null, reason: `no match for "${oldEpisodeId}"` };
  }

  const newArray = [HOST_NAME, episodeTitle, newEpisodeId];
  if (extraInfo) {
    newArray.push(extraInfo);
  }

  const newTemplate = templateFromTemplateData(
    {
      arrayData: newArray,
    },
    NEW_TEMPLATE_NAME,
  );

  return { newTemplate };
}

function processPage(
  api: ReturnType<typeof WikiApi>,
  byNumber: Map<number, string>,
  bySlug: Map<string, string>,
) {
  return (page: WikiPage) => async () => {
    const content = page.revisions?.[0]?.slots?.main['*'];
    const revid = page.revisions?.[0]?.revid;
    if (!content || !revid) {
      console.log(`No content/revid for ${page.title}`);
      return;
    }

    const templates = findTemplates(content, OLD_TEMPLATE_NAME, page.title);
    if (!templates.length) {
      return;
    }

    let newContent = content;
    let changed = 0;

    templates.forEach((template) => {
      const { newTemplate, reason } = processTemplate(template, page.title, byNumber, bySlug);
      if (!newTemplate) {
        console.log(`Skip ${page.title}: ${reason}. template=${template}`);
        return;
      }

      newContent = newContent.replace(template, newTemplate);
      changed += 1;
    });

    if (newContent === content) {
      return;
    }

    if (DRY_RUN) {
      console.log(`DRY-RUN updated ${page.title} (${changed}/${templates.length})`);
      return;
    }

    await api.edit(page.title, SUMMARY, newContent, revid);
    console.log(`Updated ${page.title} (${changed}/${templates.length})`);
  };
}

export default async function convertOsimeHistoriaTemplates() {
  const links = osimhistoriaLinks as string[];
  const { byNumber, bySlug } = buildEpisodeMaps(links);
  console.log(`Loaded ${links.length} links, ${bySlug.size} podcast slugs, ${byNumber.size} numeric mappings`);

  const api = WikiApi();
  await api.login();

  const generator = api.getArticlesWithTemplate(OLD_TEMPLATE_NAME);
  await asyncGeneratorMapWithSequence<WikiPage>(1, generator, (page) => processPage(api, byNumber, bySlug)(page));
}
