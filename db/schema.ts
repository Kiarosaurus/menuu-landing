import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const leads = sqliteTable("leads", {
 email: text("email").primaryKey(),
 createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
 consentVersion: text("consent_version").notNull().default("pilot-v1"),
});
