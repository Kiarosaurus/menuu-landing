CREATE TABLE kitchens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 40),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 70),
  image_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT ''
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'kitchen')),
  kitchen_id TEXT REFERENCES kitchens(id),
  student_code TEXT,
  career TEXT,
  birth_date TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (role <> 'consumer' OR lower(email) LIKE '%@utec.edu.pe'),
  CHECK (role <> 'consumer' OR (student_code IS NOT NULL AND length(student_code)=9 AND student_code NOT GLOB '*[^0-9]*')),
  CHECK (role <> 'consumer' OR (career IS NOT NULL AND length(career) BETWEEN 2 AND 80)),
  CHECK (role <> 'kitchen' OR kitchen_id IS NOT NULL),
  CHECK (role = 'consumer' OR birth_date IS NULL),
  CHECK (birth_date IS NULL OR birth_date >= '1900-01-01')
);
CREATE UNIQUE INDEX users_student_code_unique ON users(student_code) WHERE student_code IS NOT NULL;

CREATE TABLE dishes (
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 90),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  PRIMARY KEY (kitchen_id,id)
);

CREATE TABLE option_groups (
  kitchen_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single','multiple')),
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)),
  max_selections INTEGER CHECK (max_selections IS NULL OR max_selections > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id,dish_id,id),
  FOREIGN KEY (kitchen_id,dish_id) REFERENCES dishes(kitchen_id,id),
  CHECK (selection_type <> 'single' OR max_selections = 1)
);
CREATE TABLE option_choices (
  kitchen_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id,dish_id,group_id,id),
  FOREIGN KEY (kitchen_id,dish_id,group_id) REFERENCES option_groups(kitchen_id,dish_id,id)
);

CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  kitchen_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  offer_date TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  pickup_until TEXT NOT NULL,
  booking_deadline_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count BETWEEN 0 AND capacity),
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sold_out_at TEXT,
  description_override TEXT CHECK (description_override IS NULL OR length(description_override) <= 90),
  price_override_cents INTEGER CHECK (price_override_cents IS NULL OR price_override_cents >= 0),
  customization_override INTEGER NOT NULL DEFAULT 0 CHECK (customization_override IN (0,1)),
  FOREIGN KEY (kitchen_id,dish_id) REFERENCES dishes(kitchen_id,id),
  UNIQUE (kitchen_id,dish_id,offer_date,delivery_time),
  CHECK (pickup_until > delivery_time),
  CHECK ((CAST(substr(pickup_until,1,2) AS INTEGER)*60 + CAST(substr(pickup_until,4,2) AS INTEGER)) - (CAST(substr(delivery_time,1,2) AS INTEGER)*60 + CAST(substr(delivery_time,4,2) AS INTEGER)) <= 10)
);
CREATE INDEX offers_date_idx ON offers(offer_date,delivery_time);
CREATE INDEX offers_booking_deadline_idx ON offers(booking_deadline_at);
CREATE INDEX offers_kitchen_date_idx ON offers(kitchen_id,offer_date,delivery_time);

CREATE TABLE offer_option_groups (
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single','multiple')),
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1)),
  max_selections INTEGER CHECK (max_selections IS NULL OR max_selections > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id,id),
  CHECK (selection_type <> 'single' OR max_selections = 1)
);
CREATE TABLE offer_option_choices (
  offer_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id,group_id,id),
  FOREIGN KEY (offer_id,group_id) REFERENCES offer_option_groups(offer_id,id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id),
  kitchen_name TEXT NOT NULL,
  offer_date TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  pickup_until TEXT NOT NULL,
  pickup_point TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reservado','cancelado')),
  payment TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending','delivered','no_show')),
  review_enabled INTEGER NOT NULL DEFAULT 0 CHECK (review_enabled IN (0,1))
);
CREATE INDEX orders_user_created_idx ON orders(user_id,created_at DESC);
CREATE INDEX orders_user_fulfillment_idx ON orders(user_id,fulfillment_status);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id),
  offer_id TEXT NOT NULL REFERENCES offers(id),
  dish_name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  comment TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 200),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(id,order_id)
);
CREATE INDEX order_items_order_idx ON order_items(order_id,sort_order);
CREATE INDEX order_items_offer_idx ON order_items(offer_id);
CREATE TABLE order_item_choices (
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  group_id TEXT NOT NULL,
  group_title TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  choice_label TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(order_item_id,group_id,choice_id)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);
CREATE TABLE booking_requests (
  user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY(user_id,request_key)
);
CREATE INDEX booking_requests_created_idx ON booking_requests(created_at);

CREATE TABLE order_reviews (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  kitchen_rating INTEGER NOT NULL CHECK (kitchen_rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE order_item_reviews (
  order_item_id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES order_reviews(order_id) ON DELETE CASCADE,
  food_rating INTEGER NOT NULL CHECK (food_rating BETWEEN 1 AND 5),
  FOREIGN KEY (order_item_id,order_id) REFERENCES order_items(id,order_id)
);

CREATE TABLE kitchen_images (
  id TEXT PRIMARY KEY,
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX kitchen_images_kitchen_idx ON kitchen_images(kitchen_id);
