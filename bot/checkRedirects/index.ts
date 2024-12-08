import NewWikiApi from '../wiki/NewWikiApi';
import DuplicateRedirects from './DuplicateRedirects';

export default async function main() {
  const api = NewWikiApi();
  await DuplicateRedirects(api);
}
