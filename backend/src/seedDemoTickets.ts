import { PrismaClient } from '@prisma/client';
import { callAiForTicket } from './ai/triage';

type DemoTicketSeed = {
  subject: string;
  customerName: string;
  customerEmail: string;
  body: string;
  status: 'OPEN' | 'CLOSED';
  createdOffsetHours: number;
  closedAfterHours?: number;
};

const demoTickets: DemoTicketSeed[] = [
  {
    subject: 'Urgent: Customers cannot access dashboard',
    customerName: 'Taylor Morgan',
    customerEmail: 'taylor.morgan@northwind.io',
    body: 'Our support team is seeing widespread login failures right now. Multiple customers are locked out and this is impacting operations. Please investigate immediately.',
    status: 'OPEN',
    createdOffsetHours: 3,
  },
  {
    subject: 'Refund request for duplicate charge',
    customerName: 'Jordan Lee',
    customerEmail: 'jordan.lee@bluecrest.com',
    body: 'I was billed twice for the Pro plan this month. Can you confirm and refund the duplicate payment?',
    status: 'OPEN',
    createdOffsetHours: 7,
  },
  {
    subject: 'API requests returning intermittent 500 errors',
    customerName: 'Casey Nguyen',
    customerEmail: 'casey.nguyen@stackgrid.ai',
    body: 'Our integration has started returning 500 errors around every 10-15 requests. This started after today\'s deploy and is affecting production workflows.',
    status: 'OPEN',
    createdOffsetHours: 12,
  },
  {
    subject: 'Cannot reset password, link expired instantly',
    customerName: 'Morgan Patel',
    customerEmail: 'morgan.patel@arcbridge.co',
    body: 'When I request a password reset, the email arrives but the reset link says expired immediately. I cannot access my account.',
    status: 'OPEN',
    createdOffsetHours: 18,
  },
  {
    subject: 'Question about annual billing discount',
    customerName: 'Riley Chen',
    customerEmail: 'riley.chen@peakops.io',
    body: 'We are on monthly billing today. Can you share annual plan pricing and whether there is a discount for 50 seats?',
    status: 'OPEN',
    createdOffsetHours: 28,
  },
  {
    subject: 'Mobile app crashes when opening attachments',
    customerName: 'Avery Brooks',
    customerEmail: 'avery.brooks@horizonlabs.dev',
    body: 'The iOS app crashes whenever I open customer ticket attachments. This is reproducible on iPhone 14 and iPhone 15.',
    status: 'OPEN',
    createdOffsetHours: 34,
  },
  {
    subject: 'Please close my account and export data',
    customerName: 'Sydney Walker',
    customerEmail: 'sydney.walker@noveltech.com',
    body: 'We are migrating systems and need to close the account. Please provide a full data export and confirm deletion steps.',
    status: 'CLOSED',
    createdOffsetHours: 41,
    closedAfterHours: 6,
  },
  {
    subject: 'Feature request: Slack triage notifications',
    customerName: 'Drew Park',
    customerEmail: 'drew.park@cruxworks.io',
    body: 'It would be helpful if urgent tickets could trigger Slack notifications for on-call support managers.',
    status: 'OPEN',
    createdOffsetHours: 50,
  },
  {
    subject: 'Billing error after seat upgrade',
    customerName: 'Nina Alvarez',
    customerEmail: 'nina.alvarez@axonlane.com',
    body: 'We upgraded from 25 to 40 seats yesterday and were billed twice. Please verify the duplicate invoice and reverse the extra charge.',
    status: 'OPEN',
    createdOffsetHours: 58,
  },
  {
    subject: 'Urgent: Production webhook outages',
    customerName: 'Liam O\'Connor',
    customerEmail: 'liam.oconnor@brightforge.io',
    body: 'Our production webhook handler stopped receiving events 40 minutes ago. This is a Sev-1 incident for our support workflow.',
    status: 'OPEN',
    createdOffsetHours: 64,
  },
  {
    subject: 'Need quote for 120 support seats',
    customerName: 'Priya Raman',
    customerEmail: 'priya.raman@havenworks.ai',
    body: 'Can sales share enterprise pricing for 120 agents, annual contract terms, and optional SSO add-ons?',
    status: 'OPEN',
    createdOffsetHours: 74,
  },
  {
    subject: 'Dashboard filters stop responding in Safari',
    customerName: 'Mateo Silva',
    customerEmail: 'mateo.silva@northpeaklabs.dev',
    body: 'In Safari 17, queue filters become unresponsive after applying status and priority together. Chrome works as expected.',
    status: 'OPEN',
    createdOffsetHours: 86,
  },
  {
    subject: 'Requesting VAT-ready invoice copies',
    customerName: 'Isabelle Fournier',
    customerEmail: 'isabelle.fournier@eurobridge.co',
    body: 'Please resend VAT-compliant invoices for January and February. Finance cannot reconcile tax lines with current copies.',
    status: 'CLOSED',
    createdOffsetHours: 96,
    closedAfterHours: 10,
  },
  {
    subject: 'Sales question: onboarding timeline',
    customerName: 'Grant Hughes',
    customerEmail: 'grant.hughes@oriongrowth.com',
    body: 'If we sign this month, what does onboarding look like for a 60-agent support team with Zendesk migration?',
    status: 'OPEN',
    createdOffsetHours: 112,
  },
  {
    subject: 'Customer portal pages rendering blank',
    customerName: 'Hannah Kim',
    customerEmail: 'hannah.kim@compassgrid.io',
    body: 'Several customer portal pages render blank after login. Browser console shows repeated chunk load failures.',
    status: 'OPEN',
    createdOffsetHours: 138,
  },
  {
    subject: 'Follow-up on canceled subscription credit',
    customerName: 'Omar Farouk',
    customerEmail: 'omar.farouk@waverlyops.com',
    body: 'We canceled last cycle but still have unapplied account credit. Can billing confirm how and when it will be refunded?',
    status: 'OPEN',
    createdOffsetHours: 160,
  },
  {
    subject: 'Urgent: Security lockout after SSO change',
    customerName: 'Elena Novak',
    customerEmail: 'elena.novak@vectraone.net',
    body: 'After rotating our IdP certificate, every admin account was locked out. Need immediate recovery steps.',
    status: 'OPEN',
    createdOffsetHours: 182,
  },
  {
    subject: 'Can we trial advanced analytics module?',
    customerName: 'Darius Cole',
    customerEmail: 'darius.cole@altairholdings.ai',
    body: 'Our leadership team wants a 30-day trial of advanced analytics before expanding contract scope.',
    status: 'OPEN',
    createdOffsetHours: 208,
  },
  {
    subject: 'Export API returns malformed CSV headers',
    customerName: 'Mina Adebayo',
    customerEmail: 'mina.adebayo@riverpath.io',
    body: 'CSV exports include duplicate header rows and broken delimiter placement. This started after your March API update.',
    status: 'CLOSED',
    createdOffsetHours: 236,
    closedAfterHours: 20,
  },
  {
    subject: 'Need clarification on overage pricing',
    customerName: 'Jonas Weber',
    customerEmail: 'jonas.weber@fieldcrest.co',
    body: 'What are overage rates once monthly conversation limits are exceeded on the Growth plan?',
    status: 'OPEN',
    createdOffsetHours: 264,
  },
  {
    subject: 'Technical bug: attachments fail over 12MB',
    customerName: 'Chloe Barnes',
    customerEmail: 'chloe.barnes@helixlogic.dev',
    body: 'Attachments above 12MB fail with a generic network error despite docs saying 20MB support. We can reproduce consistently.',
    status: 'OPEN',
    createdOffsetHours: 308,
  },
  {
    subject: 'Procurement request for SOC2 and DPA',
    customerName: 'Rohan Sethi',
    customerEmail: 'rohan.sethi@paragonfin.ai',
    body: 'Before contract signature, procurement needs your latest SOC2 report and signed DPA template.',
    status: 'OPEN',
    createdOffsetHours: 348,
  },
  {
    subject: 'Invoice still includes removed seats',
    customerName: 'Kira Volkov',
    customerEmail: 'kira.volkov@acornpath.com',
    body: 'We reduced agent seats from 42 to 30 last cycle, but invoice still charges full previous seat count.',
    status: 'CLOSED',
    createdOffsetHours: 392,
    closedAfterHours: 24,
  },
  {
    subject: 'Misc request: keyboard shortcuts guide',
    customerName: 'Tyler Mason',
    customerEmail: 'tyler.mason@ridgepoint.io',
    body: 'Do you have a published list of keyboard shortcuts for triage and bulk actions? Team wants to speed up handling.',
    status: 'OPEN',
    createdOffsetHours: 438,
  },
  {
    subject: 'Critical latency spike in agent inbox',
    customerName: 'Noah Ibrahim',
    customerEmail: 'noah.ibrahim@latticeops.dev',
    body: 'Inbox load times jumped from 2s to 18s since this morning and agents are blocked on high-volume queues.',
    status: 'OPEN',
    createdOffsetHours: 490,
  },
  {
    subject: 'Sales inquiry: migration services for 3 brands',
    customerName: 'Asha Mehta',
    customerEmail: 'asha.mehta@verdanthq.com',
    body: 'We manage support for three brands and want migration + setup services bundled into enterprise pricing.',
    status: 'OPEN',
    createdOffsetHours: 548,
  },
  {
    subject: 'Billing follow-up: annual prepay discount',
    customerName: 'Caleb Reed',
    customerEmail: 'caleb.reed@meridianlabs.ai',
    body: 'Can you confirm annual prepay discount options and whether unused monthly credits can be rolled into annual billing?',
    status: 'OPEN',
    createdOffsetHours: 602,
  },
  {
    subject: 'Misc: account owner transfer process',
    customerName: 'Jules Tanaka',
    customerEmail: 'jules.tanaka@oakridge.cloud',
    body: 'Our previous admin left the company. Please share the process for transferring account ownership securely.',
    status: 'CLOSED',
    createdOffsetHours: 654,
    closedAfterHours: 36,
  },
];

function boolEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

export async function ensureDemoTickets(): Promise<void> {
  const prisma = new PrismaClient();
  const hourMs = 60 * 60 * 1000;
  const now = new Date();

  try {
    if (process.env.AUTO_SEED_DEMO_TICKETS === 'false') {
      return;
    }

    const forceReseed = boolEnv(process.env.FORCE_RESEED_DEMO_TICKETS);
    const existingCount = await prisma.ticket.count();

    if (existingCount > 0 && !forceReseed) {
      return;
    }

    if (forceReseed && existingCount > 0) {
      await prisma.ticketAIAnalysis.deleteMany();
      await prisma.ticket.deleteMany();
    }

    for (const ticketSeed of demoTickets) {
      const createdAt = new Date(now.getTime() - ticketSeed.createdOffsetHours * hourMs);
      const ticket = await prisma.ticket.create({
        data: {
          subject: ticketSeed.subject,
          customerName: ticketSeed.customerName,
          customerEmail: ticketSeed.customerEmail,
          body: ticketSeed.body,
          status: ticketSeed.status,
          createdAt,
        },
      });

      if (ticketSeed.status === 'CLOSED') {
        const closedAfterHours = ticketSeed.closedAfterHours ?? 8;
        const candidateClosedAt = new Date(createdAt.getTime() + closedAfterHours * hourMs);
        const closedAt = candidateClosedAt > now ? now : candidateClosedAt;

        await prisma.$executeRaw`
          UPDATE "Ticket"
          SET "updatedAt" = ${closedAt}
          WHERE "id" = ${ticket.id}
        `;
      }
    }

    console.log(`Seeded ${demoTickets.length} demo tickets.`);
  } finally {
    await prisma.$disconnect();
  }
}

export async function backfillMissingTicketAnalyses(): Promise<number> {
  const prisma = new PrismaClient();

  try {
    const ticketsWithoutAnalysis = await prisma.ticket.findMany({
      where: {
        aiAnalysis: {
          is: null,
        },
      },
      select: {
        id: true,
        subject: true,
        body: true,
        customerName: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (ticketsWithoutAnalysis.length === 0) {
      return 0;
    }

    let backfilled = 0;

    for (const ticket of ticketsWithoutAnalysis) {
      try {
        const aiResult = await callAiForTicket(
          {
            id: ticket.id,
            subject: ticket.subject,
            body: ticket.body,
            customerName: ticket.customerName,
          },
          null,
        );

        await prisma.ticketAIAnalysis.create({
          data: {
            ticketId: ticket.id,
            aiTag: aiResult.tag,
            aiPriority: aiResult.priority,
            aiSuggestedReply: aiResult.suggestedReply,
            aiProvider: aiResult.provider,
            aiModel: aiResult.needsReview ? `${aiResult.model} (Needs review)` : aiResult.model,
            acceptedByAgent: null,
            finalReply: null,
          },
        });

        backfilled += 1;
      } catch (error) {
        // Ignore duplicates from concurrent analyze requests; continue backfill.
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes('unique')) {
          continue;
        }

        console.error(`Failed to auto-classify ticket ${ticket.id}:`, error);
      }
    }

    return backfilled;
  } finally {
    await prisma.$disconnect();
  }
}
