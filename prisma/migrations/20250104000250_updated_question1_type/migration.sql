/*
  Warnings:

  - The `question1` column on the `CWStepDetail` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "CWStepDetail" DROP COLUMN "question1",
ADD COLUMN     "question1" BOOLEAN;
