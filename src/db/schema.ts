import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

import type { DiffLine } from "@/lib/diffart";

export const notes = sqliteTable("notes", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    content: text("content").notNull(),
    scene: integer("scene").notNull(),
    status: text("status", { enum: ["pending", "approved"] })
        .notNull()
        .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" })
        .notNull()
        .default(sql`(unixepoch())`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
});

export const projects = sqliteTable("projects", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    url: text("url").notNull(),
    position: integer("position").notNull().default(0),
});

export const pullRequests = sqliteTable(
    "pull_requests",
    {
        repo: text("repo").notNull(),
        number: integer("number").notNull(),
        title: text("title").notNull(),
        state: text("state", { enum: ["open", "merged"] }).notNull(),
        date: integer("date", { mode: "timestamp" }).notNull(),
        headSha: text("head_sha").notNull(),
        additions: integer("additions").notNull(),
        deletions: integer("deletions").notNull(),
        window: text("window", { mode: "json" }).$type<DiffLine[]>().notNull(),
    },
    (t) => [primaryKey({ columns: [t.repo, t.number] })],
);

export const contributionDays = sqliteTable("contribution_days", {
    date: text("date").primaryKey(),
    level: integer("level").notNull(),
    count: integer("count").notNull(),
});
