ALTER TABLE orders
  ADD COLUMN fulfillment_status text NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'delivered', 'no_show')),
  ADD COLUMN review_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE order_reviews (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  kitchen_rating smallint NOT NULL CHECK (kitchen_rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ADD CONSTRAINT order_items_id_order_unique UNIQUE (id, order_id);

CREATE TABLE order_item_reviews (
  order_item_id bigint PRIMARY KEY,
  order_id text NOT NULL REFERENCES order_reviews(order_id) ON DELETE CASCADE,
  food_rating smallint NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  FOREIGN KEY (order_item_id, order_id) REFERENCES order_items(id, order_id)
);

CREATE INDEX orders_user_fulfillment_idx ON orders (user_id, fulfillment_status);
