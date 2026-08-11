import type { APIRoute } from "astro";
import { db, ensureDbInitialized } from "../../../../db/client";
import { posts, comments } from "../../../../db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const prerender = false;

// ─── GET: Fetch a single post by slug ───
export const GET: APIRoute = async ({ params }) => {
  try {
    const slug = params.slug;
    if (!slug) {
      return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400 });
    }

    const postResults = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);

    if (postResults.length === 0) {
      return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
    }

    const post = postResults[0];

    // Increment view count asynchronously
    db.update(posts)
      .set({ viewsCount: sql`${posts.viewsCount} + 1` })
      .where(eq(posts.id, post.id))
      .execute()
      .catch((err) => console.error("Failed to increment views:", err));

    // Fetch comments
    const postComments = await db
      .select({
        id: comments.id,
        postSlug: comments.postSlug,
        authorName: comments.authorName,
        authorAvatar: comments.authorAvatar,
        content: comments.content,
        parentId: comments.parentId,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .where(eq(comments.postSlug, slug))
      .orderBy(desc(comments.createdAt));

    const formattedPost = {
      ...post,
      images: post.images ? JSON.parse(post.images) : [post.coverImage],
      tags: post.tags ? JSON.parse(post.tags) : [],
      comments: postComments,
    };

    return new Response(
      JSON.stringify({
        success: true,
        post: formattedPost,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API GET Post error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to fetch post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// ─── PUT: Update a post by slug ───
export const PUT: APIRoute = async ({ params, request, cookies }) => {
  // Verify admin session
  const authCookie = cookies.get("auth_user");
  if (!authCookie) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized. Admin login required." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await ensureDbInitialized();
    const slug = params.slug;
    if (!slug) {
      return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400 });
    }

    const body = await request.json();
    const { title, caption, coverImage, images, location, tags, published } = body;

    // Find existing post
    const existing = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    if (existing.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Post not found" }), { status: 404 });
    }

    const tagsArray = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",").map((t: string) => t.trim()).filter(Boolean) : undefined;
    const imagesArray = Array.isArray(images) && images.length > 0 ? images : undefined;

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (title !== undefined) updateData.title = title;
    if (caption !== undefined) updateData.caption = caption;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (imagesArray !== undefined) updateData.images = JSON.stringify(imagesArray);
    if (location !== undefined) updateData.location = location;
    if (tagsArray !== undefined) updateData.tags = JSON.stringify(tagsArray);
    if (published !== undefined) updateData.published = published;

    await db.update(posts).set(updateData).where(eq(posts.slug, slug));

    // Fetch updated post
    const updatedResult = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    const updatedPost = updatedResult[0];

    return new Response(
      JSON.stringify({
        success: true,
        post: {
          ...updatedPost,
          images: updatedPost.images ? JSON.parse(updatedPost.images) : [updatedPost.coverImage],
          tags: updatedPost.tags ? JSON.parse(updatedPost.tags) : [],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API PUT Post error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to update post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

// ─── DELETE: Delete a post by slug ───
export const DELETE: APIRoute = async ({ params, cookies }) => {
  // Verify admin session
  const authCookie = cookies.get("auth_user");
  if (!authCookie) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized. Admin login required." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await ensureDbInitialized();
    const slug = params.slug;
    if (!slug) {
      return new Response(JSON.stringify({ error: "Slug is required" }), { status: 400 });
    }

    // Find existing post
    const existing = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    if (existing.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Post not found" }), { status: 404 });
    }

    const postId = existing[0].id;

    // Delete related comments
    await db.delete(comments).where(eq(comments.postSlug, slug));

    // Delete the post
    await db.delete(posts).where(eq(posts.slug, slug));

    return new Response(
      JSON.stringify({ success: true, message: `Post "${slug}" deleted successfully` }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API DELETE Post error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Failed to delete post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
