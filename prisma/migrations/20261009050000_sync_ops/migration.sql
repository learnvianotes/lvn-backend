-- CreateTable
CREATE TABLE "notes"."SyncOpLog" (
    "clientOpId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOpLog_pkey" PRIMARY KEY ("clientOpId")
);

-- CreateIndex
CREATE INDEX "SyncOpLog_createdAt_idx" ON "notes"."SyncOpLog"("createdAt");

