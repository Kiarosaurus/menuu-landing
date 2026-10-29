PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS kitchens (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  test_account INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('consumer', 'kitchen')),
  kitchen_id TEXT REFERENCES kitchens(id),
  student_code TEXT,
  career TEXT,
  birth_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS users_student_code_unique ON users (student_code) WHERE student_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS dishes (
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id),
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  image_url TEXT NOT NULL DEFAULT '',
  image_alt TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (kitchen_id, id)
);

CREATE TABLE IF NOT EXISTS option_groups (
  kitchen_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  required INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id, dish_id, id),
  FOREIGN KEY (kitchen_id, dish_id) REFERENCES dishes(kitchen_id, id)
);

CREATE TABLE IF NOT EXISTS option_choices (
  kitchen_id TEXT NOT NULL,
  dish_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (kitchen_id, dish_id, group_id, id),
  FOREIGN KEY (kitchen_id, dish_id, group_id) REFERENCES option_groups(kitchen_id, dish_id, id)
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id),
  dish_id TEXT NOT NULL,
  offer_date TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  pickup_until TEXT NOT NULL,
  booking_deadline_at TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  reserved_count INTEGER NOT NULL DEFAULT 0 CHECK (reserved_count >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  description_override TEXT,
  price_override_cents INTEGER CHECK (price_override_cents >= 0),
  customization_override INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  sold_out_at TEXT,
  FOREIGN KEY (kitchen_id, dish_id) REFERENCES dishes(kitchen_id, id),
  UNIQUE (kitchen_id, dish_id, offer_date, delivery_time)
);
CREATE INDEX IF NOT EXISTS offers_date_idx ON offers (offer_date, delivery_time);
CREATE INDEX IF NOT EXISTS offers_kitchen_date_idx ON offers (kitchen_id, offer_date, delivery_time);
CREATE INDEX IF NOT EXISTS offers_booking_deadline_idx ON offers (booking_deadline_at);

CREATE TABLE IF NOT EXISTS offer_option_groups (
  offer_id TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  title TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  required INTEGER NOT NULL DEFAULT 0,
  max_selections INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id, id)
);

CREATE TABLE IF NOT EXISTS offer_option_choices (
  offer_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  id TEXT NOT NULL,
  label TEXT NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id, group_id, id),
  FOREIGN KEY (offer_id, group_id) REFERENCES offer_option_groups(offer_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id),
  kitchen_name TEXT NOT NULL,
  offer_date TEXT NOT NULL,
  delivery_time TEXT NOT NULL,
  pickup_until TEXT NOT NULL,
  pickup_point TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('reservado', 'cancelado')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending' CHECK (fulfillment_status IN ('pending', 'delivered', 'no_show')),
  review_enabled INTEGER NOT NULL DEFAULT 0,
  payment TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_fulfillment_idx ON orders (user_id, fulfillment_status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  offer_id TEXT NOT NULL REFERENCES offers(id),
  dish_name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  comment TEXT NOT NULL DEFAULT '' CHECK (length(comment) <= 200),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id, sort_order);
CREATE INDEX IF NOT EXISTS order_items_offer_idx ON order_items (offer_id);
CREATE UNIQUE INDEX IF NOT EXISTS order_items_id_order_unique ON order_items (id, order_id);

CREATE TABLE IF NOT EXISTS order_item_choices (
  order_item_id INTEGER NOT NULL REFERENCES order_items(id),
  group_id TEXT NOT NULL,
  group_title TEXT NOT NULL,
  choice_id TEXT NOT NULL,
  choice_label TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (order_item_id, group_id, choice_id)
);

CREATE TABLE IF NOT EXISTS order_reviews (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  kitchen_rating INTEGER NOT NULL CHECK (kitchen_rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_item_reviews (
  order_item_id INTEGER PRIMARY KEY REFERENCES order_items(id),
  order_id TEXT NOT NULL REFERENCES order_reviews(order_id) ON DELETE CASCADE,
  food_rating INTEGER NOT NULL CHECK (food_rating BETWEEN 1 AND 5)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS booking_requests (
  user_id TEXT NOT NULL REFERENCES users(id),
  request_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  response TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, request_key)
);
CREATE INDEX IF NOT EXISTS booking_requests_created_idx ON booking_requests (created_at);

CREATE TABLE IF NOT EXISTS kitchen_images (
  id TEXT PRIMARY KEY,
  kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  content BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS kitchen_images_kitchen_idx ON kitchen_images(kitchen_id);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
