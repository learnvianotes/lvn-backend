-- CreateIndex
CREATE INDEX "Comment_targetType_createdAt_idx" ON "core"."Comment"("targetType", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_targetType_createdAt_idx" ON "core"."Reaction"("targetType", "createdAt");

