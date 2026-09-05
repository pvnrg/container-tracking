-- CreateTable
CREATE TABLE "TruckStatusUpdate" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TruckStatusUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TruckStatusUpdate_containerId_timestamp_idx" ON "TruckStatusUpdate"("containerId", "timestamp");

-- AddForeignKey
ALTER TABLE "TruckStatusUpdate" ADD CONSTRAINT "TruckStatusUpdate_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TruckStatusUpdate" ADD CONSTRAINT "TruckStatusUpdate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
