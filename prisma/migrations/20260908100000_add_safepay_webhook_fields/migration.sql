ALTER TABLE "donations" ADD COLUMN "orderId" TEXT;
ALTER TABLE "donations" ADD COLUMN "safepayPaymentId" TEXT;
ALTER TABLE "donations" ADD COLUMN "safepayEventId" TEXT;
CREATE UNIQUE INDEX "donations_orderId_key" ON "donations"("orderId");
CREATE UNIQUE INDEX "donations_safepayEventId_key" ON "donations"("safepayEventId");