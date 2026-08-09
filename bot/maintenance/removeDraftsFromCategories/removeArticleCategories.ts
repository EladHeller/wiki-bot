import { getInnerLinks } from '../../wiki/wikiLinkParser';

const removeArticleCategories = (content: string): string => {
  const links = getInnerLinks(content)
    .filter(({ link }) => link.startsWith('קטגוריה:') && !link.startsWith('קטגוריה:ויקיפדיה:'));

  return links.reduce(
    (newContent, { link }) => newContent.replaceAll(`[[${link}`, `[[:${link}`),
    content,
  );
};

export default removeArticleCategories;
