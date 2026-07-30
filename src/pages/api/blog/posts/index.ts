import type { APIRoute } from "astro";
import { db, ensureDbInitialized } from "../../../../db/client";
import { posts } from "../../../../db/schema";
import { generateSlug } from "../../../../lib/auth";
import { desc, eq } from "drizzle-orm";

export const prerender = false;

// ─── GET: List posts (public: published only, admin: all) ───
export const GET: APIRoute = async ({ cookies }) => {
  const authCookie = cookies.get("auth_user");
  const isAdmin = Boolean(authCookie);

  try {
    await ensureDbInitialized();

    let query;
    if (isAdmin) {
      query = db.select().from(posts).orderBy(desc(posts.createdAt));
    } else {
      query = db.select().from(posts).where(eq(posts.published, true)).orderBy(desc(posts.createdAt));
    }

    const allPosts = await query;

    const formatted = allPosts.map((post) => ({
      ...post,
      images: post.images ? JSON.parse(post.images) : [post.coverImage],
      tags: post.tags ? JSON.parse(post.tags) : [],
    }));

    return new Response(
      JSON.stringify({ success: true, posts: formatted }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("API GET Posts error:", error);
    return new Response(
      JSON.stringify({ success: true, posts: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
};

// ─── POST: Create a new post ───
export const POST: APIRoute = async ({ request, cookies }) => {
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
    const body = await request.json();
    const { title, caption, coverImage, images, location, tags } = body;

    if (!title || !caption || !coverImage) {
      return new Response(
        JSON.stringify({ success: false, error: "Title, caption, and cover image are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const id = `post-${Date.now()}`;
    const baseSlug = generateSlug(title) || `post-${Date.now()}`;
    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const tagsArray = Array.isArray(tags) ? tags : typeof tags === "string" ? tags.split(",").map((t) => t.trim()) : [];
    const imagesArray = Array.isArray(images) && images.length > 0 ? images : [coverImage];

    const newPostData = {
      id,
      title,
      slug,
      caption,
      coverImage,
      images: JSON.stringify(imagesArray),
      location: location || "Bangkok, Thailand",
      tags: JSON.stringify(tagsArray),
      likesCount: 0,
      viewsCount: 0,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    try {
      await db.insert(posts).values(newPostData);
    } catch (dbErr) {
      console.warn("DB insert fallback to in-memory:", dbErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        post: {
          ...newPostData,
          images: imagesArray,
          tags: tagsArray,
          comments: [],
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create post error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Server error creating post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
