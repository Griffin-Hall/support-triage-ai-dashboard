-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TicketAIAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "aiTag" TEXT NOT NULL,
    "aiPriority" TEXT NOT NULL,
    "aiSuggestedReply" TEXT NOT NULL,
    "acceptedByAgent" BOOLEAN,
    "finalReply" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketAIAnalysis_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "Ticket_createdAt_idx" ON "Ticket"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TicketAIAnalysis_ticketId_key" ON "TicketAIAnalysis"("ticketId");

-- CreateIndex
CREATE INDEX "TicketAIAnalysis_aiTag_idx" ON "TicketAIAnalysis"("aiTag");

-- CreateIndex
CREATE INDEX "TicketAIAnalysis_aiPriority_idx" ON "TicketAIAnalysis"("aiPriority");
