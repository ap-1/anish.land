import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notes = sqliteTable("notes", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    xPercent: real("x_percent").notNull(),
    yPercent: real("y_percent").notNull(),
    status: text("status", { enum: ["pending", "approved"] })
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
