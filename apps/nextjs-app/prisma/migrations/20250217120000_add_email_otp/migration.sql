-- CreateTable
CREATE TABLE "public"."EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "requestIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OtpVerificationAttempt" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerificationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtp_email_createdAt_idx" ON "public"."EmailOtp"("email", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOtp_email_expiresAt_idx" ON "public"."EmailOtp"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailOtp_requestIp_createdAt_idx" ON "public"."EmailOtp"("requestIp", "createdAt");

-- CreateIndex
CREATE INDEX "OtpVerificationAttempt_ipAddress_createdAt_idx" ON "public"."OtpVerificationAttempt"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "OtpVerificationAttempt_email_createdAt_idx" ON "public"."OtpVerificationAttempt"("email", "createdAt");

