BEGIN;

ALTER TABLE "Order"
    ALTER COLUMN "customerId" DROP NOT NULL,
    ADD COLUMN "guestEmail" TEXT,
    ADD COLUMN "guestAccessHash" TEXT,
    ADD CONSTRAINT "Order_buyer_check" CHECK (
        ("customerId" IS NOT NULL AND "guestEmail" IS NULL AND "guestAccessHash" IS NULL)
        OR
        ("customerId" IS NULL AND "guestEmail" IS NOT NULL AND "guestAccessHash" IS NOT NULL)
    );

COMMIT;
