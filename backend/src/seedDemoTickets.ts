import { PrismaClient } from '@prisma/client';
import {
  callAiForTicket,
  Priority,
  Tag,
  type PriorityType,
  type TagType,
} from './ai/triage';

type DemoTicketTemplate = {
  subject: string;
  body: string;
  tag: TagType;
  priority: PriorityType;
};

const CUSTOMER_NAMES = [
  'Taylor Morgan',
  'Jordan Lee',
  'Casey Nguyen',
  'Morgan Patel',
  'Riley Chen',
  'Avery Brooks',
  'Sydney Walker',
  'Drew Park',
  'Nina Alvarez',
  "Liam O'Connor",
  'Priya Raman',
  'Mateo Silva',
  'Isabelle Fournier',
  'Grant Hughes',
  'Hannah Kim',
  'Omar Farouk',
  'Elena Novak',
  'Darius Cole',
  'Mina Adebayo',
  'Jonas Weber',
  'Chloe Barnes',
  'Rohan Sethi',
  'Kira Volkov',
  'Tyler Mason',
  'Noah Ibrahim',
  'Asha Mehta',
  'Caleb Reed',
  'Jules Tanaka',
  'Bianca Romero',
  'Marcus Dean',
  'Leila Hassan',
  'Ethan Wright',
  'Camila Santos',
  'Victor Hale',
  'Sofia Petrov',
  'Andre Dupont',
  'Maya Kapoor',
  'Theo Grant',
  'Anika Bose',
  'Elliot Price',
  'Nora Jamison',
  'Samir Das',
  'Irene Walsh',
  'Diego Cruz',
  'Jenna Lawson',
  'Miles Carter',
  'Paula Nguyen',
  'Rafael Ortiz',
  'Tina Park',
  'Vera Thompson',
];

const EMAIL_DOMAINS = [
  'northwind.io',
  'bluecrest.com',
  'stackgrid.ai',
  'arcbridge.co',
  'peakops.io',
  'horizonlabs.dev',
  'noveltech.com',
  'cruxworks.io',
  'axonlane.com',
  'brightforge.io',
  'havenworks.ai',
  'northpeaklabs.dev',
];

const DEMO_TICKET_TEMPLATES: DemoTicketTemplate[] = [
  {
    subject: 'Duplicate charge after plan upgrade',
    body: 'We upgraded from Growth to Scale yesterday and finance now sees two invoices for the same period. Please confirm which invoice is valid and refund the duplicate.',
    tag: Tag.BILLING,
    priority: Priority.HIGH,
  },
  {
    subject: 'Need corrected invoice with VAT number',
    body: 'Our accounting team needs invoice INV-2031 re-issued with our VAT registration number. Could billing send an updated copy today?',
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Question on annual prepay discount tiers',
    body: 'Before renewal we need annual pricing for 35, 50, and 75 seats. Can someone share discount tiers and payment terms?',
    tag: Tag.BILLING,
    priority: Priority.LOW,
  },
  {
    subject: 'Card update failed during renewal',
    body: 'The dashboard says our card was declined even though the bank confirms no decline happened. We want to avoid service interruption.',
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Refund request for canceled workspace',
    body: 'Workspace was canceled on March 2 but we were charged again on March 5. Please reverse the charge and confirm cancellation status.',
    tag: Tag.BILLING,
    priority: Priority.HIGH,
  },
  {
    subject: 'Billing portal shows wrong seat count',
    body: 'Billing page still shows 82 seats even after reducing to 64 last week. Could you sync the seat count before next invoice run?',
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Need invoice export for quarter close',
    body: 'Finance is closing the quarter and needs all invoices from Jan to Mar in CSV format. Is there a bulk export option?',
    tag: Tag.BILLING,
    priority: Priority.LOW,
  },
  {
    subject: 'Urgent billing issue with failed payment retries',
    body: 'Payment retries keep running every hour and customers lost access in two teams. We need this corrected immediately.',
    tag: Tag.BILLING,
    priority: Priority.URGENT,
  },
  {
    subject: 'Proration amount looks incorrect',
    body: 'After adding 12 seats mid-cycle the prorated line item appears 2x expected. Can billing explain calculation logic?',
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Requesting signed W-9 and remittance details',
    body: 'Procurement requires a signed W-9 and remittance contact before we can release payment for the enterprise invoice.',
    tag: Tag.BILLING,
    priority: Priority.LOW,
  },
  {
    subject: 'Credit note not applied to latest invoice',
    body: 'A credit note from last month should reduce this invoice but full amount is still due. Please apply the credit and resend.',
    tag: Tag.BILLING,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Need immediate confirmation of invoice reversal',
    body: 'Our CFO asked for written confirmation that invoice INV-2098 has been voided. This is blocking payment approvals now.',
    tag: Tag.BILLING,
    priority: Priority.HIGH,
  },
  {
    subject: 'Webhook deliveries delayed by 8-10 minutes',
    body: 'Support webhook events are arriving late and agents are missing SLA windows. We need help diagnosing queue latency.',
    tag: Tag.TECHNICAL,
    priority: Priority.HIGH,
  },
  {
    subject: 'Attachments fail to upload in Safari 17',
    body: 'Uploads above 6MB fail in Safari with a generic network error while Chrome works. Please advise if there is a workaround.',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'API 429 errors below documented rate limit',
    body: 'Our integration receives 429 responses around 55 requests/minute although docs list 90/minute for our plan.',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Critical outage: agent inbox not loading',
    body: 'All agents are seeing a blank inbox page and cannot answer customers. This is a production outage impacting support operations.',
    tag: Tag.TECHNICAL,
    priority: Priority.URGENT,
  },
  {
    subject: 'Search index appears stale after bulk import',
    body: 'After importing 4,000 tickets the search panel misses many records from the last 24 hours. Can you reindex our workspace?',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'SSO callback mismatch error in Okta setup',
    body: 'During SSO setup we receive callback URL mismatch even though values match the docs. Could support validate our config?',
    tag: Tag.TECHNICAL,
    priority: Priority.HIGH,
  },
  {
    subject: 'Dashboard reports freeze on date range changes',
    body: 'Switching from weekly to monthly range occasionally freezes the chart for several seconds and then times out.',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Need root cause for intermittent auth failures',
    body: 'Customers report intermittent sign-in failures every afternoon. We need logs and root-cause guidance to report internally.',
    tag: Tag.TECHNICAL,
    priority: Priority.HIGH,
  },
  {
    subject: 'Feature parity question for GraphQL endpoint',
    body: 'Does the GraphQL endpoint support ticket assignment mutation yet, or is that still REST-only?',
    tag: Tag.TECHNICAL,
    priority: Priority.LOW,
  },
  {
    subject: 'App performance degraded after latest release',
    body: 'Page transitions slowed from ~1s to ~6s after the latest release. Can you confirm if there is a known regression?',
    tag: Tag.TECHNICAL,
    priority: Priority.HIGH,
  },
  {
    subject: 'Mobile push notifications not delivered',
    body: 'Android agents are no longer receiving push notifications for urgent tickets. This started two days ago.',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Export endpoint returns malformed CSV',
    body: 'CSV export includes duplicated header rows and unescaped commas in subject lines. Can we get a patch timeline?',
    tag: Tag.TECHNICAL,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Security concern: suspicious login burst',
    body: 'We saw repeated failed logins from unknown IP ranges and one successful admin login. Need immediate investigation guidance.',
    tag: Tag.TECHNICAL,
    priority: Priority.URGENT,
  },
  {
    subject: 'Need enterprise quote for 180 support agents',
    body: 'We are evaluating vendors and need pricing for 180 agents with annual billing, SSO, and advanced analytics add-on.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Timeline for multilingual support feature',
    body: 'Can sales share expected timeline for multilingual agent UI and whether it is included in Growth or Enterprise?',
    tag: Tag.SALES,
    priority: Priority.LOW,
  },
  {
    subject: 'Procurement asks for MSA and DPA redlines',
    body: 'Legal requested your standard MSA and DPA templates so we can begin enterprise contract review this week.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Requesting pilot with sandbox migration support',
    body: 'Before signing, we want a 30-day pilot and assistance migrating historical ticket data from Zendesk.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Need proposal for multi-brand rollout',
    body: 'We manage support for three brands and need a phased rollout proposal with seat allocation and training options.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Urgent contract question before board review',
    body: 'Our board review is tomorrow and we need final commercial terms and uptime commitments tonight.',
    tag: Tag.SALES,
    priority: Priority.HIGH,
  },
  {
    subject: 'Can we bundle premium support in annual plan?',
    body: 'Is premium support available as a bundle for annual enterprise contracts, and what is the response-time SLA?',
    tag: Tag.SALES,
    priority: Priority.LOW,
  },
  {
    subject: 'RFP response package request',
    body: 'Please share an RFP response package including security controls, customer references, and implementation plan.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Need quote revision with volume discount',
    body: 'Could you revise quote Q-447 to reflect a 3-year commitment and higher initial seat volume discount?',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Clarification on onboarding services scope',
    body: 'We need clarity on what is included in onboarding services versus paid professional services for enterprise rollout.',
    tag: Tag.SALES,
    priority: Priority.LOW,
  },
  {
    subject: 'Help center article link appears broken',
    body: 'The article linked from onboarding email opens a 404 page. Please update the link so our team can complete training.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Need admin ownership transfer instructions',
    body: 'Our previous workspace owner left the company. We need the documented ownership transfer process for compliance.',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Question about roadmap for custom fields',
    body: 'Do you have an ETA for editable custom fields in the ticket list view? Our operations team is asking for this.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Requesting training session for new agents',
    body: 'We hired 20 new agents and want a live training session on triage workflows and automation best practices.',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Partnership inquiry with regional BPO',
    body: 'We run a regional BPO and want to explore partnership opportunities around your AI triage workflow.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Account notifications arriving too frequently',
    body: 'Agents are receiving duplicate notification emails for the same ticket updates. Can this be tuned per workspace?',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Urgent question from executive team',
    body: 'Leadership asked for immediate clarification on your incident communication process before today\'s customer briefing.',
    tag: Tag.MISC,
    priority: Priority.HIGH,
  },
  {
    subject: 'Need updated security contact details',
    body: 'Please share the correct security contact alias and escalation path for coordinated vulnerability disclosure.',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Feature idea: keyboard shortcuts cheat sheet',
    body: 'Our team would benefit from a printable keyboard shortcut guide for high-volume triage sessions.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Branding question for white-label portal',
    body: 'Can we fully remove your logo from customer portal notifications under our current enterprise contract?',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Request to join customer advisory board',
    body: 'We are interested in your advisory board for roadmap feedback and quarterly product planning sessions.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Can support share SLA policy document?',
    body: 'Our compliance team needs a copy of your current SLA policy and escalation matrix for vendor records.',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Feedback: onboarding checklist is excellent',
    body: 'No issue to report; we wanted to share that the new onboarding checklist significantly helped our rollout.',
    tag: Tag.MISC,
    priority: Priority.LOW,
  },
  {
    subject: 'Need escalation contact for weekend incidents',
    body: 'Could you provide the weekend escalation contact and expected acknowledgement window for Sev-1 support incidents?',
    tag: Tag.MISC,
    priority: Priority.MEDIUM,
  },
  {
    subject: 'Final quote request with SOC2 package',
    body: 'Procurement needs final commercial quote and SOC2 documentation bundle to complete vendor approval this week.',
    tag: Tag.SALES,
    priority: Priority.MEDIUM,
  },
];

function boolEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes'].includes(value.trim().toLowerCase());
}

function toCustomerEmail(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.+/g, '.').replace(/^\.|\.$/g, '');
  const domain = EMAIL_DOMAINS[index % EMAIL_DOMAINS.length];
  const discriminator = (index % 5) + 1;
  return `${slug}${discriminator}@${domain}`;
}

function buildSuggestedReply(tag: TagType, customerName: string): string {
  const firstName = customerName.split(' ')[0];

  if (tag === Tag.BILLING) {
    return `Hi ${firstName},\n\nThanks for flagging this billing request. We are validating the account ledger now and will follow up with exact invoice actions shortly.\n\nBest regards,\nSupport Team`;
  }

  if (tag === Tag.TECHNICAL) {
    return `Hi ${firstName},\n\nThanks for reporting this issue. We have opened an engineering investigation and will share concrete remediation steps after log review.\n\nBest regards,\nSupport Team`;
  }

  if (tag === Tag.SALES) {
    return `Hi ${firstName},\n\nThanks for your interest. We are routing this to our sales team with your requirements so they can provide a tailored proposal.\n\nBest regards,\nSupport Team`;
  }

  return `Hi ${firstName},\n\nThanks for reaching out. We have captured your request and routed it to the right team for follow-up.\n\nBest regards,\nSupport Team`;
}

function buildDemoTicketSeeds(): Array<DemoTicketTemplate & { customerName: string; customerEmail: string; createdOffsetHours: number }> {
  return DEMO_TICKET_TEMPLATES.map((template, index) => {
    const customerName = CUSTOMER_NAMES[index % CUSTOMER_NAMES.length];
    const createdOffsetHours = 4 + index * 6 + (index % 4) * 3;

    return {
      ...template,
      customerName,
      customerEmail: toCustomerEmail(customerName, index),
      createdOffsetHours,
    };
  });
}

export async function ensureDemoTickets(): Promise<void> {
  const prisma = new PrismaClient();
  const hourMs = 60 * 60 * 1000;
  const now = new Date();
  const expectedDemoCount = DEMO_TICKET_TEMPLATES.length;

  try {
    if (process.env.AUTO_SEED_DEMO_TICKETS === 'false') {
      return;
    }

    const forceReseed = boolEnv(process.env.FORCE_RESEED_DEMO_TICKETS);
    const existingCount = await prisma.ticket.count();
    const existingClosedCount = existingCount > 0 ? await prisma.ticket.count({ where: { status: 'CLOSED' } }) : 0;
    const needsUpgradeReseed =
      existingCount > 0 && (existingCount < expectedDemoCount || existingClosedCount > 0);

    if (existingCount > 0 && !forceReseed && !needsUpgradeReseed) {
      return;
    }

    if ((forceReseed || needsUpgradeReseed) && existingCount > 0) {
      await prisma.ticketAIAnalysis.deleteMany();
      await prisma.ticket.deleteMany();
    }

    const demoTickets = buildDemoTicketSeeds();

    for (const ticketSeed of demoTickets) {
      const createdAt = new Date(now.getTime() - ticketSeed.createdOffsetHours * hourMs);
      const ticket = await prisma.ticket.create({
        data: {
          subject: ticketSeed.subject,
          customerName: ticketSeed.customerName,
          customerEmail: ticketSeed.customerEmail,
          body: ticketSeed.body,
          status: 'OPEN',
          createdAt,
          aiAnalysis: {
            create: {
              aiTag: ticketSeed.tag,
              aiPriority: ticketSeed.priority,
              aiSuggestedReply: buildSuggestedReply(ticketSeed.tag, ticketSeed.customerName),
              aiProvider: 'DEMO_SEED',
              aiModel: 'Demo Fixture v1',
              acceptedByAgent: null,
              finalReply: null,
              createdAt,
            },
          },
        },
        include: {
          aiAnalysis: {
            select: {
              id: true,
            },
          },
        },
      });

      await prisma.$executeRaw`
        UPDATE "Ticket"
        SET "updatedAt" = ${createdAt}
        WHERE "id" = ${ticket.id}
      `;

      if (ticket.aiAnalysis?.id) {
        await prisma.$executeRaw`
          UPDATE "TicketAIAnalysis"
          SET "updatedAt" = ${createdAt}
          WHERE "id" = ${ticket.aiAnalysis.id}
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
