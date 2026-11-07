import { drizzle } from "drizzle-orm/d1";

import { notes } from "@/db/schema";

import type { APIRoute } from "astro";

export const prerender = false;

const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const POST: APIRoute = async ({ request, locals }) => {
    let body: { content?: unknown; scene?: unknown } | null;
    try {
        body = await request.json();
    } catch {
        return json({ error: "Malformed JSON" }, 400);
    }

    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const length = [...content].length;
    if (length < 5 || length > 80) return json({ error: "Content must be 5 to 80 characters" }, 400);

    const scene = body?.scene;
    if (typeof scene !== "number" || !Number.isInteger(scene) || scene < 0 || scene > 19) {
        return json({ error: "Scene must be an integer from 0 to 19" }, 400);
    }

    const [{ id }] = await drizzle(locals.runtime.env.DB)
        .insert(notes)
        .values({
            content,
            scene,
            ipAddress: request.headers.get("CF-Connecting-IP"),
            userAgent: request.headers.get("User-Agent"),
        })
        .returning({ id: notes.id });

    return json({ id }, 201);
};
