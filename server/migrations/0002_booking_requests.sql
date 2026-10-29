CREATE TABLE booking_requests (
  user_id text NOT NULL REFERENCES users(id),
  request_key text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_key)
);
CREATE INDEX booking_requests_created_idx ON booking_requests (created_at);
