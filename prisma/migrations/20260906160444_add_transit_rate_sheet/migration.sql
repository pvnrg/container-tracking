-- CreateTable
CREATE TABLE "TransitRateSheet" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransitRateSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLineItem" (
    "id" TEXT NOT NULL,
    "rateSheetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransitRateSheet_shipmentId_key" ON "TransitRateSheet"("shipmentId");

-- AddForeignKey
ALTER TABLE "TransitRateSheet" ADD CONSTRAINT "TransitRateSheet_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateLineItem" ADD CONSTRAINT "RateLineItem_rateSheetId_fkey" FOREIGN KEY ("rateSheetId") REFERENCES "TransitRateSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
