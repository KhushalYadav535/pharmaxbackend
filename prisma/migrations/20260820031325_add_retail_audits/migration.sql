-- CreateTable
CREATE TABLE "retail_audits" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shelfSharePercent" DOUBLE PRECISION,
    "productPlacement" INTEGER,
    "priceCompliance" BOOLEAN NOT NULL DEFAULT false,
    "competitorVisibility" BOOLEAN NOT NULL DEFAULT false,
    "stockAvailability" TEXT[],
    "outOfStock" TEXT[],
    "displayCompliance" BOOLEAN NOT NULL DEFAULT false,
    "competitorSchemes" TEXT,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retail_audits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "retail_audits" ADD CONSTRAINT "retail_audits_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retail_audits" ADD CONSTRAINT "retail_audits_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
