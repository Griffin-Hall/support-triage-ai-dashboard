import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// String constants (since SQLite doesn't support enums)
const Status = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

const Tag = {
  BILLING: 'BILLING',
  TECHNICAL: 'TECHNICAL',
  ACCOUNT: 'ACCOUNT',
  URGENT: 'URGENT',
  GENERAL: 'GENERAL',
} as const;

const Priority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
} as const;

// Sample ticket templates organized by expected tag
const ticketTemplates: Array<{
  subject: string;
  body: string;
  expectedTag: string;
  expectedPriority: string;
}> = [
  // Billing tickets
  {
    subject: "Unexpected charge on my credit card",
    body: "Hi, I noticed a charge of $49.99 on my credit card from your company on March 1st, but I thought I was on the free plan. Can you please explain this charge and process a refund if this was an error?",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Request for invoice for tax purposes",
    body: "Hello, I need an official invoice for my subscription payments from January 2023 to December 2023 for tax filing purposes. Could you please send this to me?",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Refund request - double charged",
    body: "I was charged twice for my monthly subscription this month. My account shows two transactions on the same day. Please refund the duplicate charge.",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Update payment method",
    body: "My credit card expired and I need to update my payment information to avoid service interruption. Where can I do this in my account?",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Billing cycle change request",
    body: "Currently I'm on monthly billing. I'd like to switch to annual billing to get the discount. Can you help me with this change?",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Question about prorated charges",
    body: "I upgraded my plan mid-month and see a prorated charge. Can you explain how this was calculated? The amount seems higher than expected.",
    expectedTag: Tag.BILLING,
    expectedPriority: Priority.MEDIUM,
  },

  // Technical tickets
  {
    subject: "API returning 500 errors",
    body: "Since this morning, all my API calls to /v1/users are returning 500 Internal Server Error. This is affecting our production application. Please help urgently!",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Integration not working with new update",
    body: "After updating to version 2.5.0, the webhook integration stopped working. I'm not receiving any webhook events. Can you help debug this?",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Slow performance on dashboard",
    body: "The dashboard takes over 30 seconds to load when I have more than 100 items. This makes it very difficult to use. Is there a way to optimize this?",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Bug: Export to CSV not working",
    body: "When I click the 'Export to CSV' button, nothing happens. I've tried in Chrome and Firefox. No file is downloaded.",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Error message when uploading files",
    body: "I'm getting an error 'File size exceeds limit' when trying to upload a 5MB PDF, but the documentation says the limit is 10MB. Is this a bug?",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Documentation unclear on OAuth setup",
    body: "The OAuth 2.0 setup documentation is missing steps about the redirect URL configuration. Could you clarify this or update the docs?",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Mobile app crashes on startup",
    body: "The iOS app crashes immediately after the splash screen on my iPhone 12 running iOS 17.2. I've tried reinstalling but it still crashes.",
    expectedTag: Tag.TECHNICAL,
    expectedPriority: Priority.HIGH,
  },

  // Account tickets
  {
    subject: "Cannot log in to my account",
    body: "I've forgotten my password and the password reset email is not arriving in my inbox or spam folder. Can you help me regain access to my account?",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Two-factor authentication issues",
    body: "I lost my phone and can't access my 2FA codes. I'm locked out of my account. How can I recover access?",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Change account email address",
    body: "I need to change my account email from old@company.com to new@company.com because I changed jobs. How do I update this?",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Close my account",
    body: "I'd like to permanently delete my account and all associated data. Please confirm what data will be removed and process this request.",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Add team members to my account",
    body: "I recently upgraded to the Team plan. How do I invite my colleagues to join my account? I can't find the team management section.",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Account settings not saving",
    body: "When I update my notification preferences and click Save, the changes don't persist. The page reloads and my old settings are back.",
    expectedTag: Tag.ACCOUNT,
    expectedPriority: Priority.MEDIUM,
  },

  // Urgent tickets
  {
    subject: "URGENT: System down - cannot access critical data",
    body: "Our entire team cannot access the platform. This is blocking our operations. We need immediate assistance to restore access.",
    expectedTag: Tag.URGENT,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Security concern - suspicious login activity",
    body: "I received multiple login alerts from locations I've never been to. I think my account may be compromised. Please secure it immediately.",
    expectedTag: Tag.URGENT,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Data breach question",
    body: "I read about a potential data breach affecting your platform. Has my data been compromised? What steps are you taking?",
    expectedTag: Tag.URGENT,
    expectedPriority: Priority.HIGH,
  },
  {
    subject: "Service outage affecting our customers",
    body: "Our customers are reporting they cannot use features powered by your API. This is causing reputational damage. Status update needed ASAP.",
    expectedTag: Tag.URGENT,
    expectedPriority: Priority.HIGH,
  },

  // General tickets
  {
    subject: "Feature request: Dark mode",
    body: "It would be great if you could add a dark mode to the dashboard. Working late at night, the bright interface is hard on the eyes.",
    expectedTag: Tag.GENERAL,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Product feedback",
    body: "I've been using your platform for 6 months and wanted to share some thoughts on the user experience. Overall it's good but there are some friction points...",
    expectedTag: Tag.GENERAL,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Partnership inquiry",
    body: "I'm interested in exploring a partnership opportunity between our companies. Who should I contact to discuss this further?",
    expectedTag: Tag.GENERAL,
    expectedPriority: Priority.LOW,
  },
  {
    subject: "Training session request",
    body: "Our team would like a training session on advanced features. Do you offer webinars or one-on-one training for enterprise customers?",
    expectedTag: Tag.GENERAL,
    expectedPriority: Priority.MEDIUM,
  },
  {
    subject: "Question about roadmap",
    body: "Is there a public roadmap we can see? I'm particularly interested in knowing when the reporting feature will be released.",
    expectedTag: Tag.GENERAL,
    expectedPriority: Priority.LOW,
  },
];

// Sample customer names
const customerNames = [
  "Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince", "Ethan Hunt",
  "Fiona Gallagher", "George Martin", "Hannah Montana", "Ian Malcolm", "Julia Roberts",
  "Kevin Hart", "Laura Croft", "Michael Scott", "Nancy Wheeler", "Oscar Martinez",
  "Pam Beesly", "Quentin Tarantino", "Rachel Green", "Steve Rogers", "Tony Stark",
  "Uma Thurman", "Victor Von Doom", "Wanda Maximoff", "Xavier Charles", "Yara Greyjoy",
  "Zoe Saldana", "Alex Chen", "Ben Parker", "Carol Danvers", "David Tennant",
  "Emma Watson", "Frank Castle", "Gina Rodriguez", "Henry Cavill", "Iris West",
  "Jack Ryan", "Kate Bishop", "Luke Cage", "Matt Murdock", "Natasha Romanoff",
];

function generateEmail(name: string): string {
  const clean = name.toLowerCase().replace(/\s+/g, '.');
  const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.com', 'example.org'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${clean}@${domain}`;
}

function randomDate(daysBack: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
  return past;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  await prisma.ticketAIAnalysis.deleteMany();
  await prisma.ticket.deleteMany();

  // Create tickets
  const tickets = [];
  
  for (const template of ticketTemplates) {
    const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
    const createdAt = randomDate(30); // Random date within last 30 days
    
    const ticket = await prisma.ticket.create({
      data: {
        subject: template.subject,
        customerName,
        customerEmail: generateEmail(customerName),
        body: template.body,
        status: Math.random() > 0.7 ? Status.CLOSED : Status.OPEN, // 30% closed
        createdAt,
      },
    });
    
    tickets.push({ ...ticket, expectedTag: template.expectedTag, expectedPriority: template.expectedPriority });
  }

  // Add some extra random tickets to reach ~50 total
  const extraSubjects = [
    { subject: "How do I export my data?", body: "I need to export all my project data for backup. Is there a way to do a full export?", tag: Tag.GENERAL },
    { subject: "Login page not loading", body: "The login page is stuck on the loading spinner. I've cleared my cache and tried different browsers.", tag: Tag.TECHNICAL },
    { subject: "Cancel subscription", body: "Please cancel my subscription effective immediately. The service no longer meets our needs.", tag: Tag.BILLING },
    { subject: "Reset 2FA device", body: "Got a new phone and need to set up 2FA again. The old device is no longer accessible.", tag: Tag.ACCOUNT },
    { subject: "Enterprise pricing question", body: "We have a team of 200 people. What are the enterprise pricing options?", tag: Tag.BILLING },
    { subject: "Bug in date picker", body: "The date picker shows wrong dates when timezone is set to UTC+5:30.", tag: Tag.TECHNICAL },
    { subject: "Can't verify email", body: "Clicking the verification link gives me a 'Token expired' error even though I just received the email.", tag: Tag.ACCOUNT },
    { subject: "Report a security vulnerability", body: "I found a potential XSS vulnerability in the comment section. What's your security disclosure process?", tag: Tag.URGENT },
    { subject: "Integration request", body: "Do you have plans to integrate with Zapier? This would be very useful for our workflow.", tag: Tag.GENERAL },
    { subject: "Data migration help", body: "We're migrating from a competitor. Is there a tool or service to help import our existing data?", tag: Tag.GENERAL },
    { subject: "API rate limits", body: "What are the API rate limits for the Pro plan? I'm getting 429 errors.", tag: Tag.TECHNICAL },
    { subject: "Invoice not received", body: "I haven't received my monthly invoice email for February. Can you resend it?", tag: Tag.BILLING },
  ];

  for (const extra of extraSubjects) {
    const customerName = customerNames[Math.floor(Math.random() * customerNames.length)];
    const createdAt = randomDate(30);
    
    await prisma.ticket.create({
      data: {
        subject: extra.subject,
        customerName,
        customerEmail: generateEmail(customerName),
        body: extra.body,
        status: Math.random() > 0.6 ? Status.CLOSED : Status.OPEN,
        createdAt,
      },
    });
  }

  console.log(`✅ Created ${ticketTemplates.length + extraSubjects.length} tickets`);
  console.log('🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
