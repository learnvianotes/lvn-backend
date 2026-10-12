-- CreateEnum
CREATE TYPE "comms"."DevicePlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateTable
CREATE TABLE "comms"."DeviceToken" (
    "token" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "comms"."DevicePlatform" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "comms"."NotificationPreference" (
    "userId" UUID NOT NULL,
    "category" "comms"."NotificationCategory" NOT NULL,
    "push" BOOLEAN,
    "email" BOOLEAN,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId","category")
);

-- CreateTable
CREATE TABLE "comms"."NotificationSettings" (
    "userId" UUID NOT NULL,
    "quietStart" TEXT NOT NULL DEFAULT '22:00',
    "quietEnd" TEXT NOT NULL DEFAULT '07:00',
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "lastDigestAt" TIMESTAMPTZ(3),

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "comms"."DeviceToken"("userId");

