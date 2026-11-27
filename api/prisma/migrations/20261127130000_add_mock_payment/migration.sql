BEGIN;

CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY', 'CREDIT_CARD');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID');

-- 旧注文は代引きとして扱い 決済日時・取引 ID は未設定とする
ALTER TABLE "Order"
    ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    ADD COLUMN "paymentPaidAt" TIMESTAMP(3),
    ADD COLUMN "paymentTransactionId" TEXT,
    ADD CONSTRAINT "Order_payment_check" CHECK (
        ("paymentMethod" = 'CASH_ON_DELIVERY' AND "paymentStatus" = 'PENDING'
            AND "paymentPaidAt" IS NULL AND "paymentTransactionId" IS NULL)
        OR
        ("paymentMethod" = 'CREDIT_CARD' AND "paymentStatus" = 'PAID'
            AND "paymentPaidAt" IS NOT NULL AND "paymentTransactionId" IS NOT NULL)
    );

CREATE UNIQUE INDEX "Order_paymentTransactionId_key" ON "Order"("paymentTransactionId");

COMMIT;
