BEGIN;

ALTER TABLE "Customer"
    ADD COLUMN "lastNameKana" TEXT,
    ADD COLUMN "firstNameKana" TEXT,
    ADD COLUMN "phone" TEXT;

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId")
        REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CustomerAddress_customerId_createdAt_idx" ON "CustomerAddress"("customerId", "createdAt");

COMMIT;
