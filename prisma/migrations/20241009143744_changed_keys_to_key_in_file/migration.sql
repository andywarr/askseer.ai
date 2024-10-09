/*
  Warnings:

  - You are about to drop the column `keys` on the `File` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "File" DROP COLUMN "keys",
ADD COLUMN     "key" TEXT;
