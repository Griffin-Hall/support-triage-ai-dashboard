-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketAIAnalysis" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "aiTag" TEXT NOT NULL,
    "aiPriority" TEXT NOT NULL,
    "aiSuggestedReply" TEXT NOT NULL,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "acceptedByAgent" BOOLEAN,
    "finalReply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketAIAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" INTEGER NOT NULL,
    "activeProvider" TEXT,
    "openaiApiKey" TEXT,
    "geminiApiKey" TEXT,
    "kimiApiKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "TicketAIAnalysis" ADD CONSTRAINT "TicketAIAnalysis_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

