import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import { pullRequests } from "@/db/schema";
import { ART_H, ART_W, drawDiffArt } from "@/lib/diffart";
import { encodePng } from "@/lib/png";

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
    const { owner, repo, number, theme } = params;
    if (theme !== "light" && theme !== "dark") return new Response(null, { status: 404 });

    const [pr] = await drizzle(locals.runtime.env.DB)
        .select({ window: pullRequests.window, headSha: pullRequests.headSha })
        .from(pullRequests)
        .where(and(eq(pullRequests.repo, `${owner}/${repo}`), eq(pullRequests.number, Number(number))));
    if (!pr) return new Response(null, { status: 404 });

    const current = url.searchParams.get("v") === pr.headSha.slice(0, 12);
    return new Response(await encodePng(ART_W, ART_H, drawDiffArt(pr.window, theme)), {
        headers: {
            "Content-Type": "image/png",
            "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
        },
    });
};
