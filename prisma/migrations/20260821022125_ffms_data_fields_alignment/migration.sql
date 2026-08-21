/*
  Warnings:

  - The `category` column on the `retailers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[doctorCode]` on the table `doctors` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hospitalCode]` on the table `hospitals` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[productCode]` on the table `products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[retailerCode]` on the table `retailers` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `tourFromDate` to the `tour_plans` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('MARRIED', 'UNMARRIED', 'SEPARATED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CALL', 'EMAIL', 'TODO');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RetailerCategory" AS ENUM ('A', 'B', 'C', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "FareType" AS ENUM ('BUS', 'TRAIN', 'AUTO', 'OWN_VEHICLE', 'TAXI');

-- AlterEnum
ALTER TYPE "DoctorClassification" ADD VALUE 'D';

-- AlterEnum
ALTER TYPE "VisitType" ADD VALUE 'STOCKIST';

-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "address1" TEXT,
ADD COLUMN     "address2" TEXT,
ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "doctorCode" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "geoTagLat" DOUBLE PRECISION,
ADD COLUMN     "geoTagLng" DOUBLE PRECISION,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "marriageAnniversary" TIMESTAMP(3),
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "visitDays" TEXT[],
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "dailyAllowance" DOUBLE PRECISION,
ADD COLUMN     "distance" DOUBLE PRECISION,
ADD COLUMN     "fare" DOUBLE PRECISION,
ADD COLUMN     "fareType" "FareType",
ADD COLUMN     "hqId" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "miscExpenses" DOUBLE PRECISION,
ADD COLUMN     "tourFromDate" TIMESTAMP(3),
ADD COLUMN     "tourToDate" TIMESTAMP(3),
ALTER COLUMN "expenseType" DROP NOT NULL,
ALTER COLUMN "amount" SET DEFAULT 0,
ALTER COLUMN "expenseDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "hospitals" ADD COLUMN     "address1" TEXT,
ADD COLUMN     "address2" TEXT,
ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "contactDept" TEXT,
ADD COLUMN     "contactDesignation" TEXT,
ADD COLUMN     "contactFirstName" TEXT,
ADD COLUMN     "contactLastName" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "geoTagLat" DOUBLE PRECISION,
ADD COLUMN     "geoTagLng" DOUBLE PRECISION,
ADD COLUMN     "hospitalCode" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "marriageAnniversary" TIMESTAMP(3),
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "visitDays" TEXT[],
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "productScheme" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "hqId" TEXT,
ADD COLUMN     "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "applicableFrom" TIMESTAMP(3),
ADD COLUMN     "applicableTo" TIMESTAMP(3),
ADD COLUMN     "composition" TEXT,
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "productDetails" TEXT,
ADD COLUMN     "productImage" TEXT,
ADD COLUMN     "scientificName" TEXT,
ADD COLUMN     "speciality" TEXT,
ADD COLUMN     "storageTemp" DOUBLE PRECISION,
ADD COLUMN     "unitsInPackage" DOUBLE PRECISION,
ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable
ALTER TABLE "retailers" ADD COLUMN     "address1" TEXT,
ADD COLUMN     "address2" TEXT,
ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "contactDept" TEXT,
ADD COLUMN     "contactDesignation" TEXT,
ADD COLUMN     "contactFirstName" TEXT,
ADD COLUMN     "contactLastName" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "district" TEXT,
ADD COLUMN     "facebook" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "geoTagLat" DOUBLE PRECISION,
ADD COLUMN     "geoTagLng" DOUBLE PRECISION,
ADD COLUMN     "gstinNumber" TEXT,
ADD COLUMN     "instagram" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "marriageAnniversary" TIMESTAMP(3),
ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "panNumber" TEXT,
ADD COLUMN     "pin" TEXT,
ADD COLUMN     "retailerCode" TEXT,
ADD COLUMN     "stockistId" TEXT,
ADD COLUMN     "twitter" TEXT,
ADD COLUMN     "visitDays" TEXT[],
ADD COLUMN     "website" TEXT,
ADD COLUMN     "whatsappNumber" TEXT,
ALTER COLUMN "address" DROP NOT NULL,
DROP COLUMN "category",
ADD COLUMN     "category" "RetailerCategory";

-- AlterTable
ALTER TABLE "territories" ADD COLUMN     "district" TEXT,
ADD COLUMN     "pinCode" TEXT;

-- AlterTable
ALTER TABLE "tour_plans" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "hqId" TEXT,
ADD COLUMN     "jointVisit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jointVisitWith" TEXT,
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "tourFromDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tourPurpose" TEXT,
ADD COLUMN     "tourToDate" TIMESTAMP(3),
ALTER COLUMN "planDate" DROP NOT NULL,
ALTER COLUMN "planMonth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "dateOfJoining" TIMESTAMP(3),
ADD COLUMN     "department" TEXT;

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "jointVisit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jointVisitWith" TEXT,
ADD COLUMN     "nextVisit" TIMESTAMP(3),
ADD COLUMN     "productsPromoted" TEXT[],
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "stockistId" TEXT,
ADD COLUMN     "visitFeedback" TEXT,
ADD COLUMN     "visitPurpose" TEXT;

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "locationCode" TEXT,
    "name" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "hqId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interiors" (
    "id" TEXT NOT NULL,
    "interiorCode" TEXT,
    "name" TEXT NOT NULL,
    "district" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "locationId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interiors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "areaCode" TEXT,
    "name" TEXT NOT NULL,
    "locationId" TEXT,
    "hqId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cfas" (
    "id" TEXT NOT NULL,
    "cfaCode" TEXT,
    "name" TEXT NOT NULL,
    "gstinNumber" TEXT,
    "panNumber" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactDesignation" TEXT,
    "contactDept" TEXT,
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pin" TEXT,
    "areaId" TEXT,
    "hqId" TEXT,
    "mobileNumber" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "marriageAnniversary" TIMESTAMP(3),
    "website" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "cfas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stockists" (
    "id" TEXT NOT NULL,
    "stockistCode" TEXT,
    "name" TEXT NOT NULL,
    "gstinNumber" TEXT,
    "panNumber" TEXT,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactDesignation" TEXT,
    "contactDept" TEXT,
    "gender" "Gender",
    "maritalStatus" "MaritalStatus",
    "category" "RetailerCategory",
    "address1" TEXT,
    "address2" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "pin" TEXT,
    "areaId" TEXT,
    "hqId" TEXT,
    "mobileNumber" TEXT,
    "whatsappNumber" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "marriageAnniversary" TIMESTAMP(3),
    "website" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "twitter" TEXT,
    "visitDays" TEXT[],
    "cfaId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stockists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_products" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "doctor_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_products" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "hospital_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_products" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "retailer_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_visit_reports" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hqId" TEXT,
    "visitType" "VisitType" NOT NULL,
    "doctorId" TEXT,
    "hospitalId" TEXT,
    "retailerId" TEXT,
    "stockistId" TEXT,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "visitPurpose" TEXT,
    "visitFeedback" TEXT,
    "nextVisit" TIMESTAMP(3),
    "remarks" TEXT,
    "jointVisit" BOOLEAN NOT NULL DEFAULT false,
    "jointVisitWith" TEXT,
    "productsPromoted" TEXT[],
    "locationId" TEXT,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "locationAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_visit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_reports" (
    "id" TEXT NOT NULL,
    "stockistId" TEXT,
    "retailerId" TEXT,
    "productId" TEXT NOT NULL,
    "reportFromDate" TIMESTAMP(3) NOT NULL,
    "reportToDate" TIMESTAMP(3) NOT NULL,
    "openingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receiptQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receiptValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issueQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "issueValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dumpQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TaskType" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "createdById" TEXT,
    "queue" TEXT,
    "dueDate" TIMESTAMP(3),
    "reminder" TEXT,
    "notes" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completionDate" TIMESTAMP(3),
    "ownerAssignedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" TEXT NOT NULL,
    "hqId" TEXT,
    "surveyDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productId" TEXT,
    "competitorCompanyName" TEXT NOT NULL,
    "competitorProductName" TEXT NOT NULL,
    "competitorProductComposition" TEXT,
    "maximumRetailPrice" DOUBLE PRECISION,
    "priceToStockist" DOUBLE PRECISION,
    "priceToRetailer" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "targetYear" INTEGER NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "hqId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_locationCode_key" ON "locations"("locationCode");

-- CreateIndex
CREATE UNIQUE INDEX "interiors_interiorCode_key" ON "interiors"("interiorCode");

-- CreateIndex
CREATE UNIQUE INDEX "areas_areaCode_key" ON "areas"("areaCode");

-- CreateIndex
CREATE UNIQUE INDEX "cfas_cfaCode_key" ON "cfas"("cfaCode");

-- CreateIndex
CREATE UNIQUE INDEX "stockists_stockistCode_key" ON "stockists"("stockistCode");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_products_doctorId_productId_key" ON "doctor_products"("doctorId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_products_hospitalId_productId_key" ON "hospital_products"("hospitalId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "retailer_products_retailerId_productId_key" ON "retailer_products"("retailerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_doctorCode_key" ON "doctors"("doctorCode");

-- CreateIndex
CREATE UNIQUE INDEX "hospitals_hospitalCode_key" ON "hospitals"("hospitalCode");

-- CreateIndex
CREATE UNIQUE INDEX "products_productCode_key" ON "products"("productCode");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_retailerCode_key" ON "retailers"("retailerCode");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interiors" ADD CONSTRAINT "interiors_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfas" ADD CONSTRAINT "cfas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cfas" ADD CONSTRAINT "cfas_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockists" ADD CONSTRAINT "stockists_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockists" ADD CONSTRAINT "stockists_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockists" ADD CONSTRAINT "stockists_cfaId_fkey" FOREIGN KEY ("cfaId") REFERENCES "cfas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_products" ADD CONSTRAINT "doctor_products_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_products" ADD CONSTRAINT "doctor_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitals" ADD CONSTRAINT "hospitals_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_products" ADD CONSTRAINT "hospital_products_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_products" ADD CONSTRAINT "hospital_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailers" ADD CONSTRAINT "retailers_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "stockists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_products" ADD CONSTRAINT "retailer_products_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_products" ADD CONSTRAINT "retailer_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "stockists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_visit_reports" ADD CONSTRAINT "daily_visit_reports_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "stockists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plans" ADD CONSTRAINT "tour_plans_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plans" ADD CONSTRAINT "tour_plans_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_plans" ADD CONSTRAINT "tour_plans_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reports" ADD CONSTRAINT "stock_reports_stockistId_fkey" FOREIGN KEY ("stockistId") REFERENCES "stockists"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reports" ADD CONSTRAINT "stock_reports_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_reports" ADD CONSTRAINT "stock_reports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_hqId_fkey" FOREIGN KEY ("hqId") REFERENCES "territories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
