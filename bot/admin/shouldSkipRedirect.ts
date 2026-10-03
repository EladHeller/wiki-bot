import { WikiPage } from '../types';

export default function shouldSkipRedirect(page: WikiPage): boolean {
  return page.ns === 0 && page.links?.length === 1 && page.links[0].ns === 2
    && page.links[0].title.startsWith('משתמש:יאצקין52/');
}
