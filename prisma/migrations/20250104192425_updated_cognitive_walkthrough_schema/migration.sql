/*
  Warnings:

  - You are about to drop the `CWStepDetail` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "CWIssueType" AS ENUM ('DISCOVERABILITY', 'LEARNABILITY', 'USABILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "CWQuestionType" AS ENUM ('QUESTION_1', 'QUESTION_2', 'QUESTION_3', 'QUESTION_4', 'UNKNOWN');

-- DropForeignKey
ALTER TABLE "CWStepDetail" DROP CONSTRAINT "CWStepDetail_stepId_fkey";

-- DropTable
DROP TABLE "CWStepDetail";

-- CreateTable
CREATE TABLE "CWQuestion" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "questionType" "CWQuestionType",
    "questionAnswer" TEXT,

    CONSTRAINT "CWQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CWIssue" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "issueType" "CWIssueType",
    "issue" TEXT,

    CONSTRAINT "CWIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CWRecommendation" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "source" "SourceType" NOT NULL,

    CONSTRAINT "CWRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CWQuestion_stepId_idx" ON "CWQuestion"("stepId");

-- CreateIndex
CREATE INDEX "CWIssue_stepId_idx" ON "CWIssue"("stepId");

-- CreateIndex
CREATE INDEX "CWRecommendation_issueId_idx" ON "CWRecommendation"("issueId");

-- CreateIndex
CREATE INDEX "CWStep_id_idx" ON "CWStep"("id");

-- AddForeignKey
ALTER TABLE "CWQuestion" ADD CONSTRAINT "CWQuestion_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CWStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CWIssue" ADD CONSTRAINT "CWIssue_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CWStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CWRecommendation" ADD CONSTRAINT "CWRecommendation_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "CWIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
