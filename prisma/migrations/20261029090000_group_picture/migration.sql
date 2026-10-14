-- AlterEnum
ALTER TYPE "notes"."FileParentType" ADD VALUE 'GROUP';

-- AlterEnum
ALTER TYPE "notes"."FilePurpose" ADD VALUE 'GROUP_PICTURE';

-- AlterTable
ALTER TABLE "core"."Group" ADD COLUMN     "pictureFileId" UUID;

