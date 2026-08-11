import type { APIRoute } from "astro";
import { db } from "../../../../db/client";
import { comments } from "../../../../db/schema";
import { eq, sql } from "drizzle-orm";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { commentId } = body;

    if (!commentId) {
      return new Response(JSON.stringify({ error: "commentId is required" }), { status: 400 });
    }

    await db
      .update(comments)
      .set({ likesCount: sql`${comments.likesCount} + 1` })
      .where(eq(comments.id, commentId));

    const updated = await db
      .select({ likesCount: comments.likesCount })
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);

    const newLikesCount = updated[0]?.likesCount || 0;

    return new Response(
      JSON.stringify({ success: true, likesCount: newLikesCount }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API POST Comment Like error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to like comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
