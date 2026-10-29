ALTER TABLE users
  ADD COLUMN student_code text,
  ADD COLUMN career text,
  ADD CONSTRAINT consumer_student_code_format CHECK (
    role <> 'consumer' OR student_code IS NULL OR student_code ~ '^[A-Z0-9-]{4,24}$'
  ),
  ADD CONSTRAINT consumer_career_length CHECK (
    role <> 'consumer' OR career IS NULL OR (char_length(career) BETWEEN 2 AND 80)
  );

CREATE UNIQUE INDEX users_student_code_unique ON users (lower(student_code)) WHERE student_code IS NOT NULL;
