-- CreateTable
CREATE TABLE "trials_attempts" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trials_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trials_completions" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "referralCount" INTEGER NOT NULL DEFAULT 0,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trials_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trials_attempts_wallet_key" ON "trials_attempts"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "trials_completions_wallet_key" ON "trials_completions"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "trials_completions_refCode_key" ON "trials_completions"("refCode");
