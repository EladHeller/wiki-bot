export interface ArticleLog {
    title: string;
    text: string;
    error?: boolean;
    skipped?: boolean;
    needProtection?: boolean;
    rank?: number;
}
