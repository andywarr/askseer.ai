-- CreateEnum
CREATE TYPE "ViolatedValueType" AS ENUM ('yes', 'no');

-- CreateTable
CREATE TABLE "HeuristicEvaluationResult" (
    "id" SERIAL NOT NULL,
    "heuristicEvaluationId" INTEGER NOT NULL,
    "heuristic" TEXT NOT NULL,
    "violated" "ViolatedValueType" NOT NULL,
    "reason" TEXT NOT NULL,

    CONSTRAINT "HeuristicEvaluationResult_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HeuristicEvaluationResult" ADD CONSTRAINT "HeuristicEvaluationResult_heuristicEvaluationId_fkey" FOREIGN KEY ("heuristicEvaluationId") REFERENCES "HeuristicEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
