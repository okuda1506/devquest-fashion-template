BEGIN;

-- 既存の作成日時を引き継ぎ 更新日時の初期値にする
ALTER TABLE "Order" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Order" SET "updatedAt" = "createdAt";
ALTER TABLE "Order"
    ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "CustomerAddress" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "CustomerAddress" SET "updatedAt" = "createdAt";
ALTER TABLE "CustomerAddress"
    ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "updatedAt" SET NOT NULL;

-- Prisma と直接 SQL の更新を同じルールで記録する
CREATE FUNCTION thread_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW."updatedAt" := clock_timestamp();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    -- 作成時刻を持たない既存行には移行時刻を設定する
    FOREACH table_name IN ARRAY ARRAY[
        'Product', 'ProductCategory', 'Customer', 'Member', 'CartItem', 'OrderShippingAddress', 'OrderItem'
    ] LOOP
        EXECUTE format(
            'ALTER TABLE %I ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                            ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
            table_name
        );
    END LOOP;

    FOREACH table_name IN ARRAY ARRAY[
        'Product', 'ProductCategory', 'Customer', 'CustomerAddress', 'Member',
        'CartItem', 'Order', 'OrderShippingAddress', 'OrderItem'
    ] LOOP
        EXECUTE format(
            'CREATE TRIGGER thread_update_timestamp BEFORE UPDATE ON %I
                 FOR EACH ROW EXECUTE FUNCTION thread_set_updated_at()',
            table_name
        );
    END LOOP;
END;
$$;

COMMIT;
