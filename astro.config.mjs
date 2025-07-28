// @ts-check
import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
    adapter: cloudflare({
        platformProxy: {
            enabled: false,
            configPath: "./wrangler.jsonc",
        }
    }),
    site: "https://anish.land",
    vite: {
        plugins: [tailwindcss()],
    },
});
