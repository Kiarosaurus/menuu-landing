ALTER TABLE users
  ADD COLUMN birth_date date,
  ADD CONSTRAINT consumer_birth_date_only CHECK (role = 'consumer' OR birth_date IS NULL),
  ADD CONSTRAINT consumer_birth_date_min CHECK (birth_date IS NULL OR birth_date >= DATE '1900-01-01');
