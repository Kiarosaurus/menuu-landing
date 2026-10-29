UPDATE users
SET student_code = '999900001'
WHERE id = 'estudiante-demo' AND student_code = '99990001';

ALTER TABLE users DROP CONSTRAINT consumer_student_code_format;
ALTER TABLE users ADD CONSTRAINT consumer_student_code_format
  CHECK (role <> 'consumer' OR student_code IS NULL OR student_code ~ '^[0-9]{9}$') NOT VALID;
