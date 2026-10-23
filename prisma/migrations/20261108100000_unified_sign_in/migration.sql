-- One account, several sign-in methods (ADR-0100). Provider identities stay on OAuthAccount, unique on
-- (provider, providerSubject). A password is attached to an existing account only after the emailed link is used.
-- Google's on/off switch is a row in AppSetting (created by 20261108090000_college_id_verification).
-- Inserted on, so a deployment that already set FIREBASE_PROJECT_ID keeps Google sign-in.

-- AlterEnum
ALTER TYPE "users"."EmailTokenPurpose" ADD VALUE 'LINK_EMAIL';

-- AlterTable
ALTER TABLE "users"."OAuthAccount" RENAME COLUMN "providerUserId" TO "providerSubject";

-- RenameIndex
ALTER INDEX "users"."OAuthAccount_provider_providerUserId_key" RENAME TO "OAuthAccount_provider_providerSubject_key";

-- AlterTable
ALTER TABLE "users"."EmailToken" ADD COLUMN "passwordHash" TEXT;

-- AppSetting.google_sign_in. A missing row is treated as on; this insert makes that explicit on existing databases.
INSERT INTO "users"."AppSetting" ("key", "enabled", "updatedAt") VALUES ('google_sign_in', true, CURRENT_TIMESTAMP);
