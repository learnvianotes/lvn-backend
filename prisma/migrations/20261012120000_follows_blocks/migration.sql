-- CreateTable
CREATE TABLE "users"."Follow" (
    "followerId" UUID NOT NULL,
    "followeeId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerId","followeeId")
);

-- CreateTable
CREATE TABLE "users"."Block" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "users"."Restriction" (
    "restricterId" UUID NOT NULL,
    "restrictedId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restriction_pkey" PRIMARY KEY ("restricterId","restrictedId")
);

-- CreateIndex
CREATE INDEX "Follow_followeeId_createdAt_idx" ON "users"."Follow"("followeeId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Follow_followerId_createdAt_idx" ON "users"."Follow"("followerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Block_blockedId_idx" ON "users"."Block"("blockedId");

-- CreateIndex
CREATE INDEX "Restriction_restrictedId_idx" ON "users"."Restriction"("restrictedId");

-- AddForeignKey
ALTER TABLE "users"."Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Follow" ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Restriction" ADD CONSTRAINT "Restriction_restricterId_fkey" FOREIGN KEY ("restricterId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users"."Restriction" ADD CONSTRAINT "Restriction_restrictedId_fkey" FOREIGN KEY ("restrictedId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

