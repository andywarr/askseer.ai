/*
  Warnings:

  - The primary key for the `File` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `HeuristicEvaluation` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `HeuristicEvaluationResult` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_heuristicEvaluationId_fkey";

-- DropForeignKey
ALTER TABLE "HeuristicEvaluationResult" DROP CONSTRAINT "HeuristicEvaluationResult_heuristicEvaluationId_fkey";

-- AlterTable
ALTER TABLE "File" DROP CONSTRAINT "File_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "heuristicEvaluationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "File_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "File_id_seq";

-- AlterTable
ALTER TABLE "HeuristicEvaluation" DROP CONSTRAINT "HeuristicEvaluation_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "HeuristicEvaluation_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "HeuristicEvaluation_id_seq";

-- AlterTable
ALTER TABLE "HeuristicEvaluationResult" DROP CONSTRAINT "HeuristicEvaluationResult_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "heuristicEvaluationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "HeuristicEvaluationResult_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "HeuristicEvaluationResult_id_seq";

-- AddForeignKey
ALTER TABLE "HeuristicEvaluationResult" ADD CONSTRAINT "HeuristicEvaluationResult_heuristicEvaluationId_fkey" FOREIGN KEY ("heuristicEvaluationId") REFERENCES "HeuristicEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_heuristicEvaluationId_fkey" FOREIGN KEY ("heuristicEvaluationId") REFERENCES "HeuristicEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
