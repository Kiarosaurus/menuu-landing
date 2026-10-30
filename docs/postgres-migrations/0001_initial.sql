CREATE TABLE kitchens (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT ''
);

CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('consumer', 'kitchen')),
  kitchen_id text REFERENCES kitchens(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consumer_utec_email CHECK (role <> 'consumer' OR email ~* '^[^@[:space:]]+@utec[.]edu[.]pe$'),
  CONSTRAINT kitchen_account_link CHECK (role <> 'kitchen' OR kitchen_id IS NOT NULL)
);

CREATE TABLE dishes (
  kitchen_id text NOT NULL REFERENCES kitchens(id),
  id text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text NOT NULL DEFAULT '',
  image_alt text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (kitchen_id, id)
);

CREATE TABLE option_groups (
  kitchen_id text NOT NULL,
  dish_id text NOT NULL,
  id text NOT NULL,
  title text NOT NULL,
  selection_type text NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  required boolean NOT NULL DEFAULT false,
  max_selections integer CHECK (max_selections IS NULL OR max_selections > 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id, dish_id, id),
  FOREIGN KEY (kitchen_id, dish_id) REFERENCES dishes(kitchen_id, id),
  CONSTRAINT single_option_limit CHECK (selection_type <> 'single' OR max_selections = 1)
);

CREATE TABLE option_choices (
  kitchen_id text NOT NULL,
  dish_id text NOT NULL,
  group_id text NOT NULL,
  id text NOT NULL,
  label text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id, dish_id, group_id, id),
  FOREIGN KEY (kitchen_id, dish_id, group_id) REFERENCES option_groups(kitchen_id, dish_id, id)
);

CREATE TABLE offers (
  id text PRIMARY KEY,
  kitchen_id text NOT NULL,
  dish_id text NOT NULL,
  offer_date date NOT NULL,
  delivery_time time NOT NULL,
  pickup_until time NOT NULL,
  capacity integer NOT NULL CHECK (capacity > 0),
  reserved_count integer NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  FOREIGN KEY (kitchen_id, dish_id) REFERENCES dishes(kitchen_id, id),
  CONSTRAINT pickup_after_arrival CHECK (pickup_until > delivery_time),
  CONSTRAINT offer_capacity CHECK (reserved_count <= capacity),
  UNIQUE (kitchen_id, dish_id, offer_date, delivery_time)
);
CREATE INDEX offers_date_idx ON offers (offer_date, delivery_time);

CREATE TABLE orders (
  id text PRIMARY KEY,
  code text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES users(id),
  kitchen_id text NOT NULL REFERENCES kitchens(id),
  kitchen_name text NOT NULL,
  offer_date date NOT NULL,
  delivery_time time NOT NULL,
  pickup_until time NOT NULL,
  pickup_point text NOT NULL,
  status text NOT NULL CHECK (status IN ('reservado', 'cancelado')),
  payment text NOT NULL,
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);

CREATE TABLE order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id),
  offer_id text NOT NULL REFERENCES offers(id),
  dish_name text NOT NULL,
  image_url text NOT NULL DEFAULT '',
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 200),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  total_cents integer NOT NULL CHECK (total_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX order_items_order_idx ON order_items (order_id, sort_order);
CREATE INDEX order_items_offer_idx ON order_items (offer_id);

CREATE TABLE order_item_choices (
  order_item_id bigint NOT NULL REFERENCES order_items(id),
  group_id text NOT NULL,
  group_title text NOT NULL,
  choice_id text NOT NULL,
  choice_label text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (order_item_id, group_id, choice_id)
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);
