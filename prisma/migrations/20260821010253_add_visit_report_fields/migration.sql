-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "businessSignal" TEXT[],
ADD COLUMN     "engagement" TEXT,
ADD COLUMN     "followUpAction" TEXT,
ADD COLUMN     "visitObjective" TEXT[];
