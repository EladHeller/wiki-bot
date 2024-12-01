export type GeneralLinkTemplateData = {
    כתובת: string;
    כותרת: string;
    הכותב?: string;
    אתר?: string;
    עמודים?: string;
    'מידע נוסף'?: string;
    תאריך?: string;
    שפה?: string;
};

export type CiteNewsTemplate = {
    title: string;
    url: string;
    date?: string;
    last?: string;
    first?: string;
    author?: string;
    'access-date'?: string;
}
