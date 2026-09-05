/*
  Warnings:

  - You are about to drop the `RoadTransitDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoadTransitDetails" DROP CONSTRAINT "RoadTransitDetails_shipmentId_fkey";

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "referenceNumber" TEXT;

-- DropTable
DROP TABLE "RoadTransitDetails";

-- CreateTable
CREATE TABLE "ContainerTransitDetails" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "transporterName" TEXT NOT NULL,
    "assignmentDate" TIMESTAMP(3),
    "loadingDate" TIMESTAMP(3),
    "truckDetails" TEXT,
    "driverDetails" TEXT,
    "journeyStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContainerTransitDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContainerTransitDetails_containerId_key" ON "ContainerTransitDetails"("containerId");

-- AddForeignKey
ALTER TABLE "ContainerTransitDetails" ADD CONSTRAINT "ContainerTransitDetails_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;
