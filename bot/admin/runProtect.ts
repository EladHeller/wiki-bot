import { main } from './protect';

main().catch((e) => {
  console.error(e?.data || e?.message || e);
  process.exit(1);
});
