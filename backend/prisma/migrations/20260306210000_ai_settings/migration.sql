-- Add provider metadata to analysis records
ALTER TABLE "TicketAIAnalysis" ADD COLUMN "aiProvider" TEXT;
ALTER TABLE "TicketAIAnalysis" ADD COLUMN "aiModel" TEXT;

-- Add persistent AI engine configuration
CREATE TABLE "AiConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY,
    "activeProvider" TEXT,
    "openaiApiKey" TEXT,
    "geminiApiKey" TEXT,
    "kimiApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "AiConfig" ("id", "activeProvider") VALUES (1, NULL);
