-- CreateTable
CREATE TABLE "Trial" (
    "userId" TEXT NOT NULL,
    "tries" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "Trial_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
