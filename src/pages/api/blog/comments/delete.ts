import type { APIRoute } from "astro";
import { db } from "../../../../db/client";
import { comments } from "../../../../db/schema";
import { eq, or } from "drizzle-orm";

export const prerender = false;

export const DELETE: APIRoute = async ({ request, url }) => {
  try {
    let commentId = url.searchParams.get("id");

    if (!commentId) {
      try {
        const body = await request.json();
        commentId = body.commentId;
      } catch {}
    }

    if (!commentId) {
      return new Response(JSON.stringify({ error: "commentId is required" }), { status: 400 });
    }

    // Delete comment and any nested replies to it
    await db
      .delete(comments)
      .where(or(eq(comments.id, commentId), eq(comments.parentId, commentId)));

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API DELETE Comment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to delete comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const POST: APIRoute = DELETE;
