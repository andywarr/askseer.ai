/*
  Warnings:

  - You are about to drop the column `resultId` on the `CWStep` table. All the data in the column will be lost.
  - You are about to drop the `CWResult` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[cognitiveWalkthroughId]` on the table `CWStep` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `cognitiveWalkthroughId` to the `CWStep` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CWResult" DROP CONSTRAINT "CWResult_cognitiveWalkthroughId_fkey";

-- DropForeignKey
ALTER TABLE "CWStep" DROP CONSTRAINT "CWStep_resultId_fkey";

-- DropIndex
DROP INDEX "CWStep_resultId_idx";

-- DropIndex
DROP INDEX "CWStep_resultId_key";

-- AlterTable
ALTER TABLE "CWStep" DROP COLUMN "resultId",
ADD COLUMN     "cognitiveWalkthroughId" TEXT NOT NULL;

-- DropTable
DROP TABLE "CWResult";

-- CreateIndex
CREATE UNIQUE INDEX "CWStep_cognitiveWalkthroughId_key" ON "CWStep"("cognitiveWalkthroughId");

-- CreateIndex
CREATE INDEX "CWStep_cognitiveWalkthroughId_idx" ON "CWStep"("cognitiveWalkthroughId");

-- CreateIndex
CREATE INDEX "CWStepDetail_stepId_idx" ON "CWStepDetail"("stepId");

-- AddForeignKey
ALTER TABLE "CWStep" ADD CONSTRAINT "CWStep_cognitiveWalkthroughId_fkey" FOREIGN KEY ("cognitiveWalkthroughId") REFERENCES "CognitiveWalkthrough"("id") ON DELETE CASCADE ON UPDATE CASCADE;
