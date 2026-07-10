/* eslint-disable no-loop-func */
import fs from 'fs';
import runOnAllEntries from './utilities';
import { getAllParagraphs, parseParagraph } from '../bot/wiki/paragraphParser';
import { findTemplate } from '../bot/wiki/newTemplateParser';
import { getInnerLinks } from '../bot/wiki/wikiLinkParser';
import WikiApi from '../bot/wiki/WikiApi';



type Page = {
    title?: string[];
    id?: string[];
    ns?: string[];
    redirect?: any;
    revision?: {
        id?: string[];
        parentid?: string[];
        timestamp?: string[];
        contributor?: {
            username?: string[];
            id?: string[];
        }[];
        comment?: string[];
        origin?: string[];
        model?: string[];
        format?: string[];
        text?: {
            _: string;
            $?: {
                bytes?: string;
                sha1?: string;
                'xml:space'?: string;
            };
        }[];
        sha1?: string[];
    }[];
};
console.debug = () => { }
export default async function helpCatalogCategoriesWith() {
    const api = WikiApi();
    await api.login()
    // const emptryReqested: string[] = [];
    // const portalWithRequested: string[] = []
    const [emptyrequestedInfo, portalWithRequestedInfo, categoriesWithMissingInfo] = await api.info([
        'user:sapper-bot/קטגוריות עם פסקת מבוקשים ריקה',
        'user:sapper-bot/קטגוריות עם מבוקשים שמפנה לפורטל',
        'user:sapper-bot/קטגוריות עם חסר או מבוקש בתוכן'
    ]);
    const writeStream = fs.createWriteStream('./result.txt')
    await runOnAllEntries((page) => {
        const title = page.title?.[0] || '';
        const text = page.revision?.[0]?.text?.[0]?._ || '';
        const ns = page.ns?.[0] || '';
        if (ns !== '14') {
            return;
        }
        if (text.includes('חסר') || text.includes('מבוקש')) {
            const content = `* [[:${title}]]\n`;
            writeStream.write(content)
        }
        const links = getInnerLinks(text).filter(x => x.link.startsWith('פורטל:') && x.link.includes('ערכים מבוקשים'))
        if (links.length) {
            // portalWithRequested.push(title)
        }
        const paragraphs = getAllParagraphs(text, title).map(parseParagraph);
        const requested = paragraphs.find(x => x.name === 'ערכים מבוקשים');
        if (!requested) {
            return;
        }
        const { content } = requested;
        const template = findTemplate(content, 'מיזמים', title)
        let netContent = content.replace(template || '', '');
        netContent = netContent.replace(/\[\[קטגוריה:[^\]]+\]\]/g, '').trim();
        if (netContent === '') {
            // emptryReqested.push(title)
        }
    })
    writeStream.end();
    // await api.create('user:sapper-bot/קטגוריות עם חסר או מבוקש בתוכן', 'בוט', categoriesWithMissing.map(x => `* [[:${x}]]`).join('\n'))
    // await api.edit('user:sapper-bot/קטגוריות עם פסקת מבוקשים ריקה', 'בוט', emptryReqested.map(x => `* [[:${x}]]`).join('\n'), emptyrequestedInfo.lastrevid || 0)
    // await api.edit('user:sapper-bot/קטגוריות עם מבוקשים שמפנה לפורטל', 'בוט', portalWithRequested.map(x => `* [[:${x}]]`).join('\n'), portalWithRequestedInfo.lastrevid || 0)
}

