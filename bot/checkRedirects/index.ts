import WikiApi from '../wiki/WikiApi';
import DuplicateRedirects from './DuplicateRedirects';

export default async function main() {
  const api = WikiApi();
  await DuplicateRedirects(api);
}
