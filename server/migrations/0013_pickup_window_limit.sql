ALTER TABLE offers
  ADD CONSTRAINT pickup_window_max_ten_minutes CHECK (pickup_until <= delivery_time + interval '10 minutes');
