import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { notes } from "@/db/schema";

import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
    try {
        const db = drizzle(locals.runtime.env.DB);

        const approvedNotes = await db
            .select({
                id: notes.id,
                content: notes.content,
                xPercent: notes.xPercent,
                yPercent: notes.yPercent,
                createdAt: notes.createdAt,
            })
            .from(notes)
            .where(eq(notes.status, "approved"));

        return new Response(JSON.stringify(approvedNotes), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to fetch notes" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};

export const POST: APIRoute = async ({ request, locals }) => {
    try {
        const { content, x, y, screenWidth, screenHeight } = await request.json() as {
            content: string;
            x: number;
            y: number;
            screenWidth: number;
            screenHeight: number;
        };

        if (!content?.trim()) {
            return new Response(JSON.stringify({ error: "Content required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        const db = drizzle(locals.runtime.env.DB);

        const result = await db
            .insert(notes)
            .values({
                content: content.trim(),
                xPercent: x / screenWidth,
                yPercent: y / screenHeight,
                // Client IP address connecting to Cloudflare to the origin web server
                ipAddress: request.headers.get("CF-Connecting-IP"),
                userAgent: request.headers.get("User-Agent"),
            })
            .returning({ id: notes.id });

        return new Response(JSON.stringify({
            success: true,
            message: "Note submitted for approval",
            id: result[0].id
        }), {
            status: 201,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: "Failed to submit note" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
};
