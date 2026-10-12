-- CreateEnum
CREATE TYPE "notes"."SearchEntity" AS ENUM ('NOTE', 'USER', 'TOPIC');

-- CreateTable
CREATE TABLE "notes"."SearchChange" (
    "id" BIGSERIAL NOT NULL,
    "entity" "notes"."SearchEntity" NOT NULL,
    "entityId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postgresAt" TIMESTAMPTZ(3),

    CONSTRAINT "SearchChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes"."SearchCollection" (
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "marker" BIGINT,
    "aliasedAt" TIMESTAMPTZ(3),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SearchCollection_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "SearchChange_entity_id_idx" ON "notes"."SearchChange"("entity", "id");


-- Triggers (ADR-0055): every change that can alter a note's or a topic's search document leaves a row, in the same
-- transaction, so no write path can forget to re-index. Prisma does not model triggers; the search parity tests
-- exercise each one.
CREATE FUNCTION "notes"."search_change_note_row"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "notes"."SearchChange" ("entity", "entityId") VALUES ('NOTE', CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END);
  RETURN NULL;
END $$;

CREATE FUNCTION "notes"."search_change_note_link"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "notes"."SearchChange" ("entity", "entityId") VALUES ('NOTE', CASE WHEN TG_OP = 'DELETE' THEN OLD."noteId" ELSE NEW."noteId" END);
  RETURN NULL;
END $$;

-- A topic's own document, and (when its title changes) the notes that carry its title.
CREATE FUNCTION "notes"."search_change_topic"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "notes"."SearchChange" ("entity", "entityId") VALUES ('TOPIC', CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END);
  IF TG_OP = 'UPDATE' AND OLD."title" IS DISTINCT FROM NEW."title" THEN
    INSERT INTO "notes"."SearchChange" ("entity", "entityId") SELECT 'NOTE', "noteId" FROM "notes"."NoteTopic" WHERE "topicId" = NEW."id";
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER "Note_search_change" AFTER UPDATE ON "notes"."Note" FOR EACH ROW
  WHEN (OLD."visibility" IS DISTINCT FROM NEW."visibility" OR OLD."moderation" IS DISTINCT FROM NEW."moderation"
    OR OLD."deletedAt" IS DISTINCT FROM NEW."deletedAt" OR OLD."publishedVersionId" IS DISTINCT FROM NEW."publishedVersionId"
    OR OLD."ownerId" IS DISTINCT FROM NEW."ownerId" OR OLD."kind" IS DISTINCT FROM NEW."kind")
  EXECUTE FUNCTION "notes"."search_change_note_row"();
CREATE TRIGGER "Note_search_delete" AFTER DELETE ON "notes"."Note" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_note_row"();
CREATE TRIGGER "NoteShare_search_change" AFTER INSERT OR UPDATE OR DELETE ON "notes"."NoteShare" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_note_link"();
CREATE TRIGGER "GroupShare_search_change" AFTER INSERT OR UPDATE OR DELETE ON "notes"."GroupShare" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_note_link"();
CREATE TRIGGER "ClassroomShare_search_change" AFTER INSERT OR UPDATE OR DELETE ON "notes"."ClassroomShare" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_note_link"();
CREATE TRIGGER "NoteTopic_search_change" AFTER INSERT OR UPDATE OR DELETE ON "notes"."NoteTopic" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_note_link"();
CREATE TRIGGER "Topic_search_change" AFTER INSERT OR UPDATE OR DELETE ON "notes"."Topic" FOR EACH ROW EXECUTE FUNCTION "notes"."search_change_topic"();
