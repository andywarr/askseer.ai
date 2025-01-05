/*
  Warnings:

  - Added the required column `source` to the `CWIssue` table without a default value. This is not possible if the table is not empty.
  - Added the required column `source` to the `CWQuestion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CWIssue" ADD COLUMN     "source" "SourceType" NOT NULL;

-- AlterTable
ALTER TABLE "CWQuestion" ADD COLUMN     "source" "SourceType" NOT NULL;
