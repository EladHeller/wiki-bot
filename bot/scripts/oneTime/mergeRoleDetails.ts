import {
  findTemplate,
  findTemplates, getTemplateKeyValueData, templateFromKeyValueData,
} from '../../wiki/newTemplateParser';
import WikiApi from '../../wiki/WikiApi';
import { WikiPage } from '../../types';

const TEMPLATE_NAME_LEADER = 'מנהיג';
const TEMPLATE_NAME_OFFICE_HOLDER = 'נושא משרה';
const NESTED_TEMPLATE_NAME = 'תפקיד מנהיג';
const TARGET_FIELD = 'תפקידים נוספים';
const ROLE_NAME_FIELD = 'שם התפקיד';
const DETAILS_FIELD = 'פירוט';

const RELEVANT_ROLE_NAMES = ['תפקידים בולטים', 'תפקידים נוספים', 'תפקידים בולטים נוספים'];

export async function processPage(page: WikiPage, api: ReturnType<typeof WikiApi>) {
  const content = page.revisions?.[0].slots.main['*'];
  const revid = page.revisions?.[0].revid;
  if (!revid || !content) {
    console.error(`missing revid or content for page ${page.title}`, { revid, content });
    return;
  }

  let newContent = content;
  let changed = false;

  const leaderTemplates = findTemplates(newContent, TEMPLATE_NAME_LEADER, page.title);
  const officeHolderTemplates = findTemplates(newContent, TEMPLATE_NAME_OFFICE_HOLDER, page.title);
  const allTemplates = [...leaderTemplates, ...officeHolderTemplates];

  for (const templateText of allTemplates) {
    const templateData = getTemplateKeyValueData(templateText);
    let templateChanged = false;

    const keys = Object.keys(templateData);
    for (const key of keys) {
      if (key.startsWith('תפקיד') && key !== TARGET_FIELD) {
        const value = templateData[key];
        const nestedTemplateText = findTemplate(value, NESTED_TEMPLATE_NAME, page.title);
        if (nestedTemplateText) {
          const nestedTemplateData = getTemplateKeyValueData(nestedTemplateText);
          const roleName = nestedTemplateData[ROLE_NAME_FIELD];

          if (RELEVANT_ROLE_NAMES.includes(roleName)) {
            const details = nestedTemplateData[DETAILS_FIELD];
            if (details) {
              if (templateData[TARGET_FIELD]) {
                templateData[TARGET_FIELD] += `{{ש}}${details}`;
              } else {
                templateData[TARGET_FIELD] = details;
              }
              delete templateData[key];
              templateChanged = true;
            }
          }
        }
      }
    }

    if (templateChanged) {
      const templateName = templateText.includes(`{{${TEMPLATE_NAME_LEADER}`) ? TEMPLATE_NAME_LEADER : TEMPLATE_NAME_OFFICE_HOLDER;
      const newTemplateText = templateFromKeyValueData(templateData, templateName);
      newContent = newContent.replace(templateText, newTemplateText);
      changed = true;
    }
  }

  if (changed) {
    console.log(`Updating ${page.title}`);
    await api.edit(page.title, 'הסבת תפקידים נוספים לשדה ייעודי', newContent, revid);
  }
}

export default async function mergeRoleDetails() {
  const api = WikiApi();
  await api.login();

  const generatorLeader = api.getArticlesWithTemplate(TEMPLATE_NAME_LEADER);
  const generatorOfficeHolder = api.getArticlesWithTemplate(TEMPLATE_NAME_OFFICE_HOLDER);

  for await (const pages of generatorLeader) {
    for (const page of pages) {
      await processPage(page, api);
    }
  }

  for await (const pages of generatorOfficeHolder) {
    for (const page of pages) {
      await processPage(page, api);
    }
  }
}
