-- Rebuild the enum because PostgreSQL does not support removing enum values.
ALTER TYPE "PaymentGateway" RENAME TO "PaymentGateway_old";

CREATE TYPE "PaymentGateway" AS ENUM ('PAYFAST', 'JAZZCASH', 'EASYPAISA');

ALTER TABLE "donations"
  ALTER COLUMN "gateway" TYPE "PaymentGateway"
  USING ("gateway"::text::"PaymentGateway");

DROP TYPE "PaymentGateway_old";