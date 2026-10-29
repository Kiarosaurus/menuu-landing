ALTER TABLE dishes
  ADD CONSTRAINT dishes_description_length CHECK (char_length(description) <= 90);
