import type { APIRoute } from "astro";
import { db } from "../../../db/client";
import { comments } from "../../../db/schema";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { postSlug, authorName = "Guest Explorer", authorAvatar, content, parentId } = body;

    if (!postSlug || !content || !content.trim()) {
      return new Response(
        JSON.stringify({ error: "postSlug and valid content are required" }),
        { status: 400 }
      );
    }

    const newComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      postSlug,
      authorName: authorName.trim(),
      authorAvatar: authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(authorName)}`,
      content: content.trim(),
      parentId: parentId || null,
    };

    await db.insert(comments).values(newComment);

    return new Response(
      JSON.stringify({
        success: true,
        comment: newComment,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API POST Comment error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to submit comment" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
