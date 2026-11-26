BEGIN;

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "firstName" TEXT,
    "passwordHash" TEXT NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Member" (LIKE "Customer" INCLUDING DEFAULTS);
ALTER TABLE "Member" ADD CONSTRAINT "Member_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- 空白で区切られた姓名を分離し 区切りがない場合は元の文字列を姓として保持する
CREATE TEMP TABLE account_names ON COMMIT DROP AS
SELECT "id", "email", "role"::text AS "role", "passwordHash",
    split_part(normalized, ' ', 1) AS "lastName",
    nullif(substr(normalized, length(split_part(normalized, ' ', 1)) + 2), '') AS "firstName"
FROM (
    SELECT *, btrim(regexp_replace("name", '[[:space:]　]+', ' ', 'g')) AS normalized
    FROM "User"
) AS accounts;

INSERT INTO "Customer" ("id", "email", "lastName", "firstName", "passwordHash")
SELECT "id", "email", "lastName", "firstName", "passwordHash" FROM account_names WHERE "role" = 'CUSTOMER';
INSERT INTO "Member" ("id", "email", "lastName", "firstName", "passwordHash")
SELECT "id", "email", "lastName", "firstName", "passwordHash" FROM account_names WHERE "role" = 'ADMIN';

ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_userId_fkey";
ALTER TABLE "CartItem" RENAME COLUMN "userId" TO "customerId";
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";
ALTER TABLE "Order" RENAME COLUMN "userId" TO "customerId";
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX "Order_userId_createdAt_idx" RENAME TO "Order_customerId_createdAt_idx";
DROP TABLE "User";
DROP TYPE "Role";

CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);
INSERT INTO "ProductCategory" ("id", "name") VALUES
    ('tops', 'トップス'), ('outerwear', 'アウター'), ('bottoms', 'ボトムス'),
    ('dresses', 'ワンピース'), ('bags', 'バッグ'), ('shoes', 'シューズ'), ('accessories', 'アクセサリー');
INSERT INTO "ProductCategory" ("id", "name")
SELECT DISTINCT "category", "category" FROM "Product" ON CONFLICT ("id") DO NOTHING;
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_fkey"
    FOREIGN KEY ("category") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "OrderShippingAddress" (
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "prefecture" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL,
    CONSTRAINT "OrderShippingAddress_pkey" PRIMARY KEY ("orderId"),
    CONSTRAINT "OrderShippingAddress_orderId_fkey" FOREIGN KEY ("orderId")
        REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "OrderShippingAddress" ("orderId", "name", "postalCode", "prefecture", "city", "line1", "line2", "phone")
SELECT "id", "shippingAddress"->>'name', "shippingAddress"->>'postalCode',
    "shippingAddress"->>'prefecture', "shippingAddress"->>'city', "shippingAddress"->>'line1',
    coalesce("shippingAddress"->>'line2', ''), "shippingAddress"->>'phone'
FROM "Order" WHERE "shippingAddress" IS NOT NULL AND "shippingAddress" <> 'null'::jsonb;
ALTER TABLE "Order" DROP COLUMN "shippingAddress";

CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

COMMIT;
