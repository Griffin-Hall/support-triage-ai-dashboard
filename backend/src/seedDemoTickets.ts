import { PrismaClient } from '@prisma/client';

const demoTickets: Array<{
  subject: string;
  customerName: string;
  customerEmail: string;
  body: string;
}> = [
  {
    subject: 'Urgent: Customers cannot access dashboard',
    customerName: 'Taylor Morgan',
    customerEmail: 'taylor.morgan@northwind.io',
    body: 'Our support team is seeing widespread login failures right now. Multiple customers are locked out and this is impacting operations. Please investigate immediately.',
  },
  {
    subject: 'Refund request for duplicate charge',
    customerName: 'Jordan Lee',
    customerEmail: 'jordan.lee@bluecrest.com',
    body: 'I was billed twice for the Pro plan this month. Can you confirm and refund the duplicate payment?',
  },
  {
    subject: 'API requests returning intermittent 500 errors',
    customerName: 'Casey Nguyen',
    customerEmail: 'casey.nguyen@stackgrid.ai',
    body: 'Our integration has started returning 500 errors around every 10-15 requests. This started after today\'s deploy and is affecting production workflows.',
  },
  {
    subject: 'Cannot reset password, link expired instantly',
    customerName: 'Morgan Patel',
    customerEmail: 'morgan.patel@arcbridge.co',
    body: 'When I request a password reset, the email arrives but the reset link says expired immediately. I cannot access my account.',
  },
  {
    subject: 'Question about annual billing discount',
    customerName: 'Riley Chen',
    customerEmail: 'riley.chen@peakops.io',
    body: 'We are on monthly billing today. Can you share annual plan pricing and whether there is a discount for 50 seats?',
  },
  {
    subject: 'Mobile app crashes when opening attachments',
    customerName: 'Avery Brooks',
    customerEmail: 'avery.brooks@horizonlabs.dev',
    body: 'The iOS app crashes whenever I open customer ticket attachments. This is reproducible on iPhone 14 and iPhone 15.',
  },
  {
    subject: 'Please close my account and export data',
    customerName: 'Sydney Walker',
    customerEmail: 'sydney.walker@noveltech.com',
    body: 'We are migrating systems and need to close the account. Please provide a full data export and confirm deletion steps.',
  },
  {
    subject: 'Feature request: Slack triage notifications',
    customerName: 'Drew Park',
    customerEmail: 'drew.park@cruxworks.io',
    body: 'It would be helpful if urgent tickets could trigger Slack notifications for on-call support managers.',
  },
];

export async function ensureDemoTickets(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    if (process.env.AUTO_SEED_DEMO_TICKETS === 'false') {
      return;
    }

    const existingCount = await prisma.ticket.count();

    if (existingCount > 0) {
      return;
    }

    await prisma.ticket.createMany({
      data: demoTickets.map((ticket, index) => ({
        ...ticket,
        status: 'OPEN',
        createdAt: new Date(Date.now() - index * 45 * 60 * 1000),
      })),
    });

    console.log(`Seeded ${demoTickets.length} demo tickets.`);
  } finally {
    await prisma.$disconnect();
  }
}
