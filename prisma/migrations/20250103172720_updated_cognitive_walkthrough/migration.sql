/*
  Warnings:

  - The values [ANOTHER_STUDY_TYPE] on the enum `StudyType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `discoverability` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `learnability` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `question1` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `question2` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `question3` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `question4` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the column `usability` on the `CWStep` table. All the data in the column will be lost.
  - Added the required column `step` to the `CWStep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "StudyType_new" AS ENUM ('HEURISTIC_EVALUATION', 'COGNITIVE_WALKTHROUGH', 'UNKNOWN');
ALTER TABLE "Study" ALTER COLUMN "type" TYPE "StudyType_new" USING ("type"::text::"StudyType_new");
ALTER TYPE "StudyType" RENAME TO "StudyType_old";
ALTER TYPE "StudyType_new" RENAME TO "StudyType";
DROP TYPE "StudyType_old";
COMMIT;

-- AlterTable
ALTER TABLE "CWStep" DROP COLUMN "discoverability",
DROP COLUMN "learnability",
DROP COLUMN "question1",
DROP COLUMN "question2",
DROP COLUMN "question3",
DROP COLUMN "question4",
DROP COLUMN "usability",
ADD COLUMN     "step" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "CWStepDetail" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "question1" TEXT,
    "question2" TEXT,
    "question3" TEXT,
    "question4" TEXT,
    "hasDiscoverabilityIssue" BOOLEAN,
    "discoverabilityIssue" TEXT,
    "discoverabilityRecommendation" TEXT,
    "hasLearnabilityIssue" BOOLEAN,
    "learnabilityIssue" TEXT,
    "learnabilityRecommendation" TEXT,
    "hasUsabilityIssue" BOOLEAN,
    "usabilityIssue" TEXT,
    "usabilityRecommendation" TEXT,
    "source" "SourceType" NOT NULL,

    CONSTRAINT "CWStepDetail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CWStepDetail" ADD CONSTRAINT "CWStepDetail_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "CWStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
