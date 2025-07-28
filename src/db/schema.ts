import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    x: integer("x").notNull(),
    y: integer("y").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
        .notNull()
        .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
});

export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
