import { db, libsqlClient } from "./client";
import { posts, comments, authors, users } from "./schema";
import { sql } from "drizzle-orm";
import { hashPassword } from "../lib/auth";

async function main() {
  console.log("🌱 Creating database tables if not exist...");

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin' NOT NULL,
      avatar TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      caption TEXT NOT NULL,
      cover_image TEXT NOT NULL,
      images TEXT,
      location TEXT,
      tags TEXT,
      likes_count INTEGER DEFAULT 0 NOT NULL,
      views_count INTEGER DEFAULT 0 NOT NULL,
      published INTEGER DEFAULT 1 NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
      updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_slug TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_avatar TEXT,
      content TEXT NOT NULL,
      parent_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_hash TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
  `);

  await libsqlClient.execute(`
    CREATE TABLE IF NOT EXISTS authors (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      website TEXT
    );
  `);

  console.log("🌱 Seeding default Admin user...");
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";
  const hashedPassword = await hashPassword(adminPassword);

  await db.insert(users).values({
    id: "user-admin-1",
    email: process.env.ADMIN_EMAIL || "admin@sitedotmoss.com",
    name: "Moss (Admin)",
    passwordHash: hashedPassword,
    role: "admin",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
  }).onConflictDoNothing();

  console.log("🌱 Seeding initial Author profile...");
  await db.insert(authors).values({
    id: "author-moss",
    username: "sitedotmoss",
    displayName: "Moss | Creative Developer & AI Specialist",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    bio: "✦ Building modern web apps, AI systems & generative UI\n✦ Researching Deep Learning & Computer Vision\n📍 Bangkok, Thailand",
    website: "https://sitedotmoss.com",
  }).onConflictDoNothing();

  console.log("🌱 Seeding sample blog posts...");

  const samplePosts = [
    {
      id: "post-1",
      title: "Redesigning sitedotmoss with Instagram Aesthetics ✨",
      slug: "redesigning-sitedotmoss-instagram-style",
      caption: "Excited to share the brand new Instagram-style Blog layout for sitedotmoss! Built using Astro, Turso SQLite, and React islands. Combined dynamic post grids, seamless lightbox modal, multi-image carousel, and real-time likes/comments.\n\nWhat do you think of this layout? Feedback is always welcome! 🚀",
      coverImage: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80"
      ]),
      location: "Bangkok, Thailand",
      tags: JSON.stringify(["webdev", "astro", "design", "turso"]),
      likesCount: 142,
      viewsCount: 1205,
      published: true,
    },
    {
      id: "post-2",
      title: "Deep Learning & Computer Vision Experiments 🧠🤖",
      slug: "deep-learning-computer-vision-experiments",
      caption: "A sneak peek into my recent computer vision model training session for real-time monolithic object detection. Optimized inference latency with TensorRT and quantization for edge deployment.\n\nCheck out the demo models live on the main dashboard!",
      coverImage: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1200&q=80"
      ]),
      location: "AI Lab",
      tags: JSON.stringify(["ai", "computer-vision", "python", "pytorch"]),
      likesCount: 98,
      viewsCount: 840,
      published: true,
    },
    {
      id: "post-3",
      title: "Minimalist Workspace setup 2026 🖥️🌿",
      slug: "minimalist-workspace-setup-2026",
      caption: "Clean desk = clear mind. Updated my daily coding environment with ergonomic setup, ambient light bars, and dual monitor arms. Ready for long building sessions!",
      coverImage: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80",
        "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1200&q=80"
      ]),
      location: "Home Office",
      tags: JSON.stringify(["workspace", "setup", "minimalism", "devlife"]),
      likesCount: 215,
      viewsCount: 2300,
      published: true,
    },
    {
      id: "post-4",
      title: "Generative UI & Micro-animations in Modern Web Apps 🎨",
      slug: "generative-ui-micro-animations",
      caption: "Why settle for static interfaces when code can feel alive? Explored spring dynamics, glassmorphism, and fluid CSS transitions for modern web applications.",
      coverImage: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1200&q=80"
      ]),
      location: "Studio Moss",
      tags: JSON.stringify(["ui", "frontend", "animation", "css"]),
      likesCount: 89,
      viewsCount: 750,
      published: true,
    }
  ];

  for (const post of samplePosts) {
    await db.insert(posts).values(post).onConflictDoUpdate({
      target: posts.id,
      set: {
        title: post.title,
        caption: post.caption,
        coverImage: post.coverImage,
        images: post.images,
        tags: post.tags,
        likesCount: post.likesCount,
      }
    });
  }

  console.log("🌱 Seeding sample comments...");
  await db.insert(comments).values([
    {
      id: "comment-1",
      postSlug: "redesigning-sitedotmoss-instagram-style",
      authorName: "Alex Developer",
      authorAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
      content: "This layout looks super sleek! Loving the grid transitions 🌟",
    },
    {
      id: "comment-2",
      postSlug: "redesigning-sitedotmoss-instagram-style",
      authorName: "Sarah Tech",
      authorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80",
      content: "Turso + Astro combination is insanely fast! Great job Moss!",
    }
  ]).onConflictDoNothing();

  console.log("✅ Seed completed successfully!");
}

main().catch((e) => {
  console.error("❌ Seed error:", e);
  process.exit(1);
});
