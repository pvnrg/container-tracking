-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "title" TEXT,
ALTER COLUMN "stage" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "isTaxPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxAmount" DECIMAL(12,2),
ADD COLUMN     "taxCurrency" TEXT DEFAULT 'USD',
ADD COLUMN     "taxLocation" TEXT,
ADD COLUMN     "taxPaidAt" TIMESTAMP(3),
ADD COLUMN     "taxReceivedBy" TEXT,
ADD COLUMN     "transitArrivalEta" TIMESTAMP(3),
ADD COLUMN     "transitStartedAt" TIMESTAMP(3);
