BEGIN;

CREATE TYPE "PaymentGateway_new" AS ENUM ('SAFE_PAY', 'JAZZCASH', 'EASYPAISA');

ALTER TABLE "donations"
  ALTER COLUMN "gateway" TYPE "PaymentGateway_new"
  USING ("gateway"::text::"PaymentGateway_new");

DROP TYPE "PaymentGateway";
ALTER TYPE "PaymentGateway_new" RENAME TO "PaymentGateway";

COMMIT;