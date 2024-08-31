import 'dotenv/config';
import protectFlags from '../scripts/oneTime/protectFlags';

export async function main() {
  await protectFlags();
}

export default main;
