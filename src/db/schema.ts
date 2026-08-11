import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// 1. Users Table (Admin authentication)
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("admin").notNull(), // admin
  avatar: text("avatar"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// 2. Blog Posts Table (Journal / Masonry Style)
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  caption: text("caption").notNull(),
  coverImage: text("cover_image").notNull(),
  images: text("images"), // JSON string array of image URLs
  location: text("location"),
  tags: text("tags"), // JSON string array of tags (e.g., ["design", "astro", "ai"])
  likesCount: integer("likes_count").default(0).notNull(),
  viewsCount: integer("views_count").default(0).notNull(),
  published: integer("published", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (table) => ([
  index("idx_posts_slug").on(table.slug),
  index("idx_posts_published").on(table.published, table.createdAt),
]));

// 3. Comments Table
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  postSlug: text("post_slug").notNull(),
  authorName: text("author_name").notNull(),
  authorAvatar: text("author_avatar"),
  content: text("content").notNull(),
  parentId: text("parent_id"), // Optional nested parent comment ID
  likesCount: integer("likes_count").default(0).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (table) => ([
  index("idx_comments_post").on(table.postSlug, table.createdAt),
]));

// 4. Post Likes Table (Prevents duplicate likes per session/user)
export const postLikes = sqliteTable("post_likes", {
  id: text("id").primaryKey(),
  postId: text("post_id").notNull(),
  userHash: text("user_hash").notNull(), // IP hash or anonymous session ID
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
}, (table) => ([
  index("idx_likes_post_user").on(table.postId, table.userHash),
]));

// 5. Authors / Profile Metadata
export const authors = sqliteTable("authors", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  website: text("website"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type PostLike = typeof postLikes.$inferSelect;
export type Author = typeof authors.$inferSelect;
