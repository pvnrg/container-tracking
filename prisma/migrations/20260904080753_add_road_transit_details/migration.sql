-- CreateTable
CREATE TABLE "RoadTransitDetails" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "transporterName" TEXT NOT NULL,
    "assignmentDate" TIMESTAMP(3),
    "loadingDate" TIMESTAMP(3),
    "truckDetails" TEXT,
    "journeyStartDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadTransitDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoadTransitDetails_shipmentId_key" ON "RoadTransitDetails"("shipmentId");

-- AddForeignKey
ALTER TABLE "RoadTransitDetails" ADD CONSTRAINT "RoadTransitDetails_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
