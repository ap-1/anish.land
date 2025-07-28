import type { Config } from "drizzle-kit";

const { CLOUDFLARE_ACCOUNT_ID, DB_ID, D1_TOKEN } = process.env;

export default {
    schema: "./src/db/schema.ts",
    out: "./src/db/migrations",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
        accountId: CLOUDFLARE_ACCOUNT_ID!,
        databaseId: DB_ID!,
        token: D1_TOKEN!,
    },
} satisfies Config;
