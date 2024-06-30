-- CreateEnum
CREATE TYPE "ValueType" AS ENUM ('nielsen', 'tenets');

-- CreateTable
CREATE TABLE "HeuristicEvaluation" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "userGoal" TEXT NOT NULL,
    "heuristic" "ValueType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HeuristicEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
    "id" SERIAL NOT NULL,
    "heuristicEvaluationId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "HeuristicEvaluation" ADD CONSTRAINT "HeuristicEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_heuristicEvaluationId_fkey" FOREIGN KEY ("heuristicEvaluationId") REFERENCES "HeuristicEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
