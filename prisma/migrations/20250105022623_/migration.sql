/*
  Warnings:

  - You are about to drop the column `expectedOutcome` on the `CWStep` table. All the data in the column will be lost.
  - Added the required column `expected` to the `CWStep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CWStep" DROP COLUMN "expectedOutcome",
ADD COLUMN     "expected" BOOLEAN NOT NULL;
