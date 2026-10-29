ALTER TABLE offers ALTER COLUMN published_at DROP NOT NULL;
UPDATE offers
SET published_at = NULL
WHERE published_at = (SELECT applied_at FROM schema_migrations WHERE name = '0010_kitchen_management.sql');
