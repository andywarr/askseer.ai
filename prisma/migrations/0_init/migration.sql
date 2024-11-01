-- CreateEnum
CREATE TYPE "StudyType" AS ENUM ('HEURISTIC_EVALUATION', 'ANOTHER_STUDY_TYPE');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO');

-- CreateEnum
CREATE TYPE "HeuristicType" AS ENUM ('NIELSEN', 'TENETS');

-- CreateEnum
CREATE TYPE "ViolatedType" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('AI', 'HUMAN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "credits" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("provider","providerAccountId")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier","token")
);

-- CreateTable
CREATE TABLE "Authenticator" (
    "credentialID" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "credentialPublicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "credentialDeviceType" TEXT NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT,

    CONSTRAINT "Authenticator_pkey" PRIMARY KEY ("userId","credentialID")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "type" "StudyType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "size" INTEGER,
    "type" "FileType",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HeuristicEvaluation" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "type" "HeuristicType" NOT NULL,

    CONSTRAINT "HeuristicEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Heuristic" (
    "id" TEXT NOT NULL,
    "heuristic" TEXT NOT NULL,
    "type" "HeuristicType" NOT NULL,

    CONSTRAINT "Heuristic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HEResult" (
    "id" TEXT NOT NULL,
    "heuristicId" TEXT NOT NULL,
    "heuristicEvaluationId" TEXT NOT NULL,
    "violated" "ViolatedType" NOT NULL,
    "reason" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,

    CONSTRAINT "HEResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HERecommendation" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,

    CONSTRAINT "HERecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Authenticator_credentialID_key" ON "Authenticator"("credentialID");

-- CreateIndex
CREATE INDEX "Authenticator_userId_idx" ON "Authenticator"("userId");

-- CreateIndex
CREATE INDEX "Study_userId_idx" ON "Study"("userId");

-- CreateIndex
CREATE INDEX "File_studyId_idx" ON "File"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "HeuristicEvaluation_studyId_key" ON "HeuristicEvaluation"("studyId");

-- CreateIndex
CREATE INDEX "HeuristicEvaluation_studyId_idx" ON "HeuristicEvaluation"("studyId");

-- CreateIndex
CREATE INDEX "HEResult_heuristicId_idx" ON "HEResult"("heuristicId");

-- CreateIndex
CREATE INDEX "HEResult_heuristicEvaluationId_idx" ON "HEResult"("heuristicEvaluationId");

-- CreateIndex
CREATE INDEX "HERecommendation_resultId_idx" ON "HERecommendation"("resultId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Authenticator" ADD CONSTRAINT "Authenticator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HeuristicEvaluation" ADD CONSTRAINT "HeuristicEvaluation_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HEResult" ADD CONSTRAINT "HEResult_heuristicEvaluationId_fkey" FOREIGN KEY ("heuristicEvaluationId") REFERENCES "HeuristicEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HEResult" ADD CONSTRAINT "HEResult_heuristicId_fkey" FOREIGN KEY ("heuristicId") REFERENCES "Heuristic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HERecommendation" ADD CONSTRAINT "HERecommendation_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "HEResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

