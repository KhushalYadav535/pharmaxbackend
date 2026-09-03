import { runBiocrosSeed } from './seed_biocros';

async function main() {
  await runBiocrosSeed();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
