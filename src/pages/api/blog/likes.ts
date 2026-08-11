import type { APIRoute } from "astro";
import { db } from "../../../db/client";
import { posts, postLikes } from "../../../db/schema";
import { eq, sql, and } from "drizzle-orm";

export const prerender = false;

// ─── GET: Fetch all post IDs liked by a specific userHash ───
export const GET: APIRoute = async ({ url }) => {
  try {
    const userHash = url.searchParams.get("userHash");
    if (!userHash) {
      return new Response(JSON.stringify({ success: true, likedPostIds: [] }), { status: 200 });
    }

    const likes = await db
      .select({ postId: postLikes.postId })
      .from(postLikes)
      .where(eq(postLikes.userHash, userHash));

    const likedPostIds = likes.map((l) => l.postId);

    return new Response(
      JSON.stringify({ success: true, likedPostIds }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API GET Likes error:", error);
    return new Response(
      JSON.stringify({ success: false, likedPostIds: [], error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// ─── POST: Toggle like on a post for userHash ───
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { postId, userHash = "anon-user" } = body;

    if (!postId) {
      return new Response(JSON.stringify({ error: "postId is required" }), { status: 400 });
    }

    // Check if user already liked
    const existingLike = await db
      .select()
      .from(postLikes)
      .where(and(eq(postLikes.postId, postId), eq(postLikes.userHash, userHash)))
      .limit(1);

    let liked = false;
    let newLikesCount = 0;

    if (existingLike.length > 0) {
      // Unlike
      await db
        .delete(postLikes)
        .where(and(eq(postLikes.postId, postId), eq(postLikes.userHash, userHash)));

      await db
        .update(posts)
        .set({ likesCount: sql`MAX(0, ${posts.likesCount} - 1)` })
        .where(eq(posts.id, postId));

      liked = false;
    } else {
      // Like
      await db.insert(postLikes).values({
        id: `like-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        postId,
        userHash,
      });

      await db
        .update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.id, postId));

      liked = true;
    }

    const updatedPost = await db.select({ likesCount: posts.likesCount }).from(posts).where(eq(posts.id, postId)).limit(1);
    newLikesCount = updatedPost[0]?.likesCount || 0;

    return new Response(
      JSON.stringify({
        success: true,
        liked,
        likesCount: newLikesCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API POST Like error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to update like" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
