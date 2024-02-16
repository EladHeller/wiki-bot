export interface ArticleLog {
    title: string;
    text: string;
    error?: boolean;
    skipped?: boolean;
    needProtection?: boolean;
    rank?: number;
}

export interface Paragraph {
    name: string;
    content: string;
}
