import { sqliteTable, text } from "drizzle-orm/sqlite-core";

// Small key/value table for app-wide facts; real tables (accounts, figures) come later.
export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
