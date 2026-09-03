-- CreateEnum
CREATE TYPE "BlType" AS ENUM ('SEA_WAYBILL', 'ORIGINAL');

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "blType" "BlType" NOT NULL DEFAULT 'ORIGINAL';
