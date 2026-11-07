// @ts-check
import { defineConfig, envField } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
    adapter: cloudflare({
        platformProxy: {
            enabled: false,
            configPath: "./wrangler.jsonc",
        },
        workerEntryPoint: {
            path: "src/worker.ts",
        },
    }),
    site: "https://anish.land",
    build: {
        format: "file",
    },
    env: {
        schema: {
            COMMIT_HASH: envField.string({ context: "server", access: "public", optional: true }),
            BUILD_DATE: envField.string({ context: "server", access: "public", optional: true }),
        },
    },
});
