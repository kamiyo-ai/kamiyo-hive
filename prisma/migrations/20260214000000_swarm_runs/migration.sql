-- CreateTable
CREATE TABLE "swarm_runs" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "mission" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "maxSteps" INTEGER NOT NULL,
    "maxBudgetPerStep" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "critiqueOk" BOOLEAN,
    "critiqueScore" INTEGER,
    "plan" JSONB NOT NULL,
    "outputs" JSONB NOT NULL,
    "final" JSONB NOT NULL,
    "critique" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swarm_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swarm_events" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stepId" TEXT,
    "data" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swarm_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swarm_runs_teamId_idx" ON "swarm_runs"("teamId");

-- CreateIndex
CREATE INDEX "swarm_runs_createdAt_idx" ON "swarm_runs"("createdAt");

-- CreateIndex
CREATE INDEX "swarm_events_runId_at_idx" ON "swarm_events"("runId", "at");

-- AddForeignKey
ALTER TABLE "swarm_events" ADD CONSTRAINT "swarm_events_runId_fkey" FOREIGN KEY ("runId") REFERENCES "swarm_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

