-- CreateTable
CREATE TABLE "TransitDriver" (
    "id" TEXT NOT NULL,
    "containerTransitDetailsId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransitDriver_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TransitDriver" ADD CONSTRAINT "TransitDriver_containerTransitDetailsId_fkey" FOREIGN KEY ("containerTransitDetailsId") REFERENCES "ContainerTransitDetails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
