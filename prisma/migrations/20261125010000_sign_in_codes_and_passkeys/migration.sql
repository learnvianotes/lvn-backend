-- ADR-0115: sign in with an emailed code, and with a passkey.
CREATE TABLE "users"."sign_in_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "codeHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sign_in_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sign_in_codes_userId_createdAt_idx" ON "users"."sign_in_codes"("userId", "createdAt");

ALTER TABLE "users"."sign_in_codes" ADD CONSTRAINT "sign_in_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "users"."passkey_credentials" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "credentialId" BYTEA NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "transports" TEXT[],
    "name" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3),

    CONSTRAINT "passkey_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "passkey_credentials_credentialId_key" ON "users"."passkey_credentials"("credentialId");
CREATE INDEX "passkey_credentials_userId_idx" ON "users"."passkey_credentials"("userId");

ALTER TABLE "users"."passkey_credentials" ADD CONSTRAINT "passkey_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
