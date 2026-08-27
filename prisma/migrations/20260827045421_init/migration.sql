-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'LOGISTICS_OPERATOR', 'TRANSPORTER');

-- CreateEnum
CREATE TYPE "DischargePort" AS ENUM ('DAR_ES_SALAAM', 'MOMBASA');

-- CreateEnum
CREATE TYPE "RwandanDestination" AS ENUM ('NYANZA_KICUKIRO', 'RWAMAGANA_INDUSTRIAL_ZONE');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('SHIPPED_ON_BOARD', 'IN_TRANSIT_SEA', 'ARRIVED_PORT_OF_DISCHARGE', 'CUSTOMS_PROCESSING', 'CUSTOMS_CLEARED', 'LOADED_ROAD_TRANSIT', 'ARRIVED_DESTINATION', 'OFFLOADED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('ON_VESSEL', 'DISCHARGED_AT_PORT', 'IN_TRANSIT_TRUCK', 'DELIVERED_WAREHOUSE', 'OFFLOADED', 'EMPTY_RETURNED_TO_DEPOT');

-- CreateEnum
CREATE TYPE "DocumentStage" AS ENUM ('ENTRY_LEVEL', 'PORT_CLEARANCE', 'ROAD_TRANSIT', 'FINAL_CLEARANCE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('COMMERCIAL_INVOICE', 'PACKING_LIST', 'BILL_OF_LADING', 'CERTIFICATE_OF_ANALYSIS', 'CUSTOMS_WH7', 'CUSTOMS_T1', 'CUSTOMS_IM4', 'TRANSPORTER_RATE_AGREEMENT', 'DESTINATION_CLEARANCE', 'DELIVERY_NOTE');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('SYSTEM', 'WHATSAPP', 'BOTH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'LOGISTICS_OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "blNumber" TEXT NOT NULL,
    "shippingLine" TEXT NOT NULL,
    "vesselName" TEXT,
    "voyageNumber" TEXT,
    "bookingRef" TEXT,
    "originCountry" TEXT NOT NULL,
    "originPort" TEXT,
    "dischargePort" "DischargePort" NOT NULL,
    "destinationWarehouse" "RwandanDestination",
    "shipperName" TEXT,
    "consigneeName" TEXT,
    "notifyParty" TEXT,
    "shippedOnBoardDate" TIMESTAMP(3),
    "currentEta" TIMESTAMP(3) NOT NULL,
    "actualDischargeDate" TIMESTAMP(3),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'SHIPPED_ON_BOARD',
    "transporterId" TEXT,
    "agreedTransportPrice" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "priceAgreedAt" TIMESTAMP(3),
    "isLoadedOnTruck" BOOLEAN NOT NULL DEFAULT false,
    "sevenDayAlertSent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "containerNumber" TEXT NOT NULL,
    "containerType" TEXT NOT NULL DEFAULT '40_HIGH_CUBE',
    "sealNumber" TEXT,
    "tareWeightKg" DECIMAL(10,2),
    "grossWeightKg" DECIMAL(10,2),
    "volumeCbm" DECIMAL(10,2),
    "inventoryReference" TEXT NOT NULL,
    "itemQuantity" INTEGER,
    "status" "ContainerStatus" NOT NULL DEFAULT 'ON_VESSEL',
    "offloadScheduledAt" TIMESTAMP(3),
    "actualOffloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DetentionTracker" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "freeTimeDays" INTEGER NOT NULL DEFAULT 30,
    "clockStartDate" TIMESTAMP(3),
    "deadlineDate" TIMESTAMP(3),
    "returnedToDepotDate" TIMESTAMP(3),
    "day15AlertSent" BOOLEAN NOT NULL DEFAULT false,
    "day22AlertSent" BOOLEAN NOT NULL DEFAULT false,
    "day28AlertSent" BOOLEAN NOT NULL DEFAULT false,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DetentionTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "stage" "DocumentStage" NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'BOTH',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "waMessageSid" TEXT,
    "waSentAt" TIMESTAMP(3),
    "waStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentAudit" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_blNumber_key" ON "Shipment"("blNumber");

-- CreateIndex
CREATE INDEX "Shipment_blNumber_idx" ON "Shipment"("blNumber");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_currentEta_idx" ON "Shipment"("currentEta");

-- CreateIndex
CREATE INDEX "Container_containerNumber_idx" ON "Container"("containerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Container_shipmentId_containerNumber_key" ON "Container"("shipmentId", "containerNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DetentionTracker_containerId_key" ON "DetentionTracker"("containerId");

-- CreateIndex
CREATE INDEX "DetentionTracker_deadlineDate_idx" ON "DetentionTracker"("deadlineDate");

-- CreateIndex
CREATE INDEX "DetentionTracker_isOverdue_idx" ON "DetentionTracker"("isOverdue");

-- CreateIndex
CREATE INDEX "Document_shipmentId_stage_idx" ON "Document"("shipmentId", "stage");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ShipmentAudit_shipmentId_idx" ON "ShipmentAudit"("shipmentId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_transporterId_fkey" FOREIGN KEY ("transporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DetentionTracker" ADD CONSTRAINT "DetentionTracker_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAudit" ADD CONSTRAINT "ShipmentAudit_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentAudit" ADD CONSTRAINT "ShipmentAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
