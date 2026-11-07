import { handle } from "@astrojs/cloudflare/handler";
import type { SSRManifest } from "astro";
import { App } from "astro/app";

import { syncGitHub } from "@/lib/sync";

type FetchArgs = Parameters<typeof handle>;

// serve the site and run the hourly GitHub sync
export function createExports(manifest: SSRManifest) {
    const app = new App(manifest);
    return {
        default: {
            fetch: (request: FetchArgs[2], env: FetchArgs[3], ctx: FetchArgs[4]) => handle(manifest, app, request, env, ctx),
            scheduled: (_controller: ScheduledController, env: Env, ctx: ExecutionContext) => ctx.waitUntil(syncGitHub(env)),
        },
    };
}
