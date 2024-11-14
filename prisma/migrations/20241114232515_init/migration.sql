-- AlterEnum
ALTER TYPE "FileType" ADD VALUE 'UNKNOWN';

-- AlterEnum
ALTER TYPE "HeuristicType" ADD VALUE 'UNKNOWN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImageType" ADD VALUE 'APNG';
ALTER TYPE "ImageType" ADD VALUE 'AVIF';
ALTER TYPE "ImageType" ADD VALUE 'WEBP';
ALTER TYPE "ImageType" ADD VALUE 'UNKNOWN';

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'UNKNOWN';

-- AlterEnum
ALTER TYPE "StudyType" ADD VALUE 'UNKNOWN';
