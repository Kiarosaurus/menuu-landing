CREATE TABLE `leads` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`consent_version` text DEFAULT 'pilot-v1' NOT NULL
);
