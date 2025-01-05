/*
  Warnings:

  - The values [QUESTION_4] on the enum `CWQuestionType` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `expectedOutcome` to the `CWStep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CWQuestionType_new" AS ENUM ('QUESTION_1', 'QUESTION_2', 'QUESTION_3', 'UNKNOWN');
ALTER TABLE "CWQuestion" ALTER COLUMN "questionType" TYPE "CWQuestionType_new" USING ("questionType"::text::"CWQuestionType_new");
ALTER TYPE "CWQuestionType" RENAME TO "CWQuestionType_old";
ALTER TYPE "CWQuestionType_new" RENAME TO "CWQuestionType";
DROP TYPE "CWQuestionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "CWStep" ADD COLUMN     "expectedOutcome" BOOLEAN NOT NULL;
