/*
  Warnings:

  - You are about to drop the `Trial` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Trial" DROP CONSTRAINT "Trial_userId_fkey";

-- DropTable
DROP TABLE "Trial";

-- CreateTable
CREATE TABLE "Credits" (
    "userId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Credits_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Credits" ADD CONSTRAINT "Credits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
