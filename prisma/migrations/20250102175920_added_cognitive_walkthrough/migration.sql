-- CreateTable
CREATE TABLE "CognitiveWalkthrough" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "context" TEXT,

    CONSTRAINT "CognitiveWalkthrough_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CWResult" (
    "id" TEXT NOT NULL,
    "cognitiveWalkthroughId" TEXT NOT NULL,

    CONSTRAINT "CWResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CWStep" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "question1" TEXT,
    "question2" TEXT,
    "question3" TEXT,
    "question4" TEXT,
    "discoverability" TEXT,
    "learnability" TEXT,
    "usability" TEXT,

    CONSTRAINT "CWStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CognitiveWalkthrough_studyId_key" ON "CognitiveWalkthrough"("studyId");

-- CreateIndex
CREATE INDEX "CognitiveWalkthrough_studyId_idx" ON "CognitiveWalkthrough"("studyId");

-- CreateIndex
CREATE INDEX "CWResult_cognitiveWalkthroughId_idx" ON "CWResult"("cognitiveWalkthroughId");

-- CreateIndex
CREATE UNIQUE INDEX "CWStep_resultId_key" ON "CWStep"("resultId");

-- CreateIndex
CREATE INDEX "CWStep_resultId_idx" ON "CWStep"("resultId");

-- AddForeignKey
ALTER TABLE "CognitiveWalkthrough" ADD CONSTRAINT "CognitiveWalkthrough_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CWResult" ADD CONSTRAINT "CWResult_cognitiveWalkthroughId_fkey" FOREIGN KEY ("cognitiveWalkthroughId") REFERENCES "CognitiveWalkthrough"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CWStep" ADD CONSTRAINT "CWStep_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "CWResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
