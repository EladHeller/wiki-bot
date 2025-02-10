import 'dotenv/config';
import languageLinks from '../maintenance/languageLinks';

export async function main() {
  await languageLinks(false);
}

export default main;
