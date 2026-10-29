ALTER TABLE offers ADD COLUMN published_at timestamptz DEFAULT now();
ALTER TABLE offers ADD COLUMN sold_out_at timestamptz;
ALTER TABLE offers ADD COLUMN description_override text CHECK (char_length(description_override) <= 90);
ALTER TABLE offers ADD COLUMN price_override_cents integer CHECK (price_override_cents >= 0);
ALTER TABLE offers ADD COLUMN customization_override boolean NOT NULL DEFAULT false;

CREATE TABLE offer_option_groups (
  offer_id text NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  id text NOT NULL,
  title text NOT NULL,
  selection_type text NOT NULL CHECK (selection_type IN ('single', 'multiple')),
  required boolean NOT NULL DEFAULT false,
  max_selections integer CHECK (max_selections IS NULL OR max_selections > 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id, id),
  CONSTRAINT offer_single_limit CHECK (selection_type <> 'single' OR max_selections = 1)
);

CREATE TABLE offer_option_choices (
  offer_id text NOT NULL,
  group_id text NOT NULL,
  id text NOT NULL,
  label text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (offer_id, group_id, id),
  FOREIGN KEY (offer_id, group_id) REFERENCES offer_option_groups(offer_id, id) ON DELETE CASCADE
);

CREATE TABLE kitchen_images (
  id text PRIMARY KEY,
  kitchen_id text NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kitchen_images_kitchen_idx ON kitchen_images(kitchen_id);
