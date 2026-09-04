-- CreateTable
CREATE TABLE "StageAgent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stage" "DocumentStage" NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "position" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageAgent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageAgent_shipmentId_stage_key" ON "StageAgent"("shipmentId", "stage");

-- AddForeignKey
ALTER TABLE "StageAgent" ADD CONSTRAINT "StageAgent_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
