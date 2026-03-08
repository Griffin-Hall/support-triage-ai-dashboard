import { backfillMissingTicketAnalyses, ensureDemoTickets } from '../src/seedDemoTickets';

async function main() {
  process.env.FORCE_RESEED_DEMO_TICKETS = 'true';
  await ensureDemoTickets();
  const backfilled = await backfillMissingTicketAnalyses();
  console.log(`Demo seed complete. Backfilled analyses: ${backfilled}`);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
