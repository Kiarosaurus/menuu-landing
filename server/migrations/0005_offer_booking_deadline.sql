ALTER TABLE offers ADD COLUMN booking_deadline_at timestamptz;

UPDATE offers
SET booking_deadline_at = ((offer_date + delivery_time) AT TIME ZONE 'America/Lima') - interval '1 minute';

ALTER TABLE offers
  ALTER COLUMN booking_deadline_at SET NOT NULL,
  ADD CONSTRAINT booking_deadline_before_delivery CHECK (
    booking_deadline_at < ((offer_date + delivery_time) AT TIME ZONE 'America/Lima')
  );

CREATE INDEX offers_booking_deadline_idx ON offers (booking_deadline_at);

UPDATE orders SET pickup_point = 'Comedor UTEC' WHERE pickup_point = 'Cafetería de UTEC';
