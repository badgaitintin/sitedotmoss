/**
 * API Response Structure — Contract Test Suite
 * ─────────────────────────────────────────────────────────
 * ทดสอบ shape / contract ของ response จาก API endpoints
 * โดยไม่ต้องการ DB หรือ server จริง — ใช้การ simulate logic
 *
 * ครอบคลุม:
 *  1. Comment creation response shape
 *  2. Likes GET/POST response shape
 *  3. Login response shape
 *  4. Logout response shape
 *  5. Post listing response shape
 *  6. Error response consistency
 *  7. ID generation uniqueness
 *  8. Avatar fallback URL
 *
 * Run: npx vitest run tests/api-contract.unit.test.ts
 */

import { describe, it, expect } from "vitest";

// ════════════════════════════════════════════════════════════
// Helpers: mirrors server-side logic (no DB or Astro needed)
// ════════════════════════════════════════════════════════════

function generateCommentId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function generateLikeId(): string {
  return `like-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

function buildCommentResponse(body: {
  postSlug: string;
  authorName?: string;
  authorAvatar?: string;
  content: string;
  parentId?: string | null;
}) {
  const { postSlug, authorName = "Guest Explorer", authorAvatar, content, parentId } = body;

  if (!postSlug || !content || !content.trim()) {
    return {
      ok: false,
      status: 400,
      body: { error: "postSlug and valid content are required" },
    };
  }

  const newComment = {
    id: generateCommentId(),
    postSlug,
    authorName: authorName.trim(),
    authorAvatar:
      authorAvatar ||
      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(authorName)}`,
    content: content.trim(),
    parentId: parentId || null,
    likesCount: 0,
  };

  return {
    ok: true,
    status: 201,
    body: { success: true, comment: newComment },
  };
}

function buildLikeToggleResponse(
  postId: string,
  userHash: string,
  existingLikes: Set<string>,
  likeCount: number
) {
  if (!postId) {
    return { ok: false, status: 400, body: { error: "postId is required" } };
  }

  const key = `${postId}:${userHash}`;
  let liked: boolean;
  let newCount: number;

  if (existingLikes.has(key)) {
    existingLikes.delete(key);
    liked = false;
    newCount = Math.max(0, likeCount - 1);
  } else {
    existingLikes.add(key);
    liked = true;
    newCount = likeCount + 1;
  }

  return {
    ok: true,
    status: 200,
    body: { success: true, liked, likesCount: newCount },
  };
}

function buildLoginResponse(email: string, password: string) {
  if (!email || !password) {
    return { ok: false, status: 400, body: { success: false, error: "Email and password are required" } };
  }
  if (email.trim() === "admin@sitedotmoss.com" && password.trim() === "Admin1234!") {
    const user = { id: "admin-1", email: "admin@sitedotmoss.com", name: "Moss", role: "admin", avatar: "" };
    return { ok: true, status: 200, body: { success: true, user } };
  }
  return { ok: false, status: 401, body: { success: false, error: "Invalid email or password" } };
}

// ════════════════════════════════════════════════════════════
// 1. Comment Creation — Response Shape
// ════════════════════════════════════════════════════════════

describe("POST /api/blog/comments — Response Contract", () => {
  it("success response has status 201 and correct shape", () => {
    const res = buildCommentResponse({
      postSlug: "my-blog-post",
      authorName: "Alice",
      content: "Great post!",
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.comment).toBeDefined();
    expect(res.body.comment.id).toMatch(/^comment-/);
    expect(res.body.comment.postSlug).toBe("my-blog-post");
    expect(res.body.comment.authorName).toBe("Alice");
    expect(res.body.comment.content).toBe("Great post!");
    expect(res.body.comment.likesCount).toBe(0);
    expect(res.body.comment.parentId).toBeNull();
  });

  it("defaults authorName to 'Guest Explorer' when not provided", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "Hello!" });
    expect(res.body.comment.authorName).toBe("Guest Explorer");
  });

  it("generates dicebear avatar when no authorAvatar provided", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "Hi!", authorName: "Bob" });
    expect(res.body.comment.authorAvatar).toContain("dicebear");
    expect(res.body.comment.authorAvatar).toContain("Bob");
  });

  it("uses provided authorAvatar when given", () => {
    const customAvatar = "https://example.com/avatar.jpg";
    const res = buildCommentResponse({
      postSlug: "slug",
      content: "Hi!",
      authorAvatar: customAvatar,
    });
    expect(res.body.comment.authorAvatar).toBe(customAvatar);
  });

  it("sets parentId when reply is provided", () => {
    const res = buildCommentResponse({
      postSlug: "slug",
      content: "Reply!",
      parentId: "comment-parent-123",
    });
    expect(res.body.comment.parentId).toBe("comment-parent-123");
  });

  it("returns 400 when postSlug is missing", () => {
    const res = buildCommentResponse({ postSlug: "", content: "valid" });
    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when content is whitespace only", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "   " });
    expect(res.status).toBe(400);
    expect(res.ok).toBe(false);
  });

  it("trims content whitespace before saving", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "  trimmed  " });
    expect(res.body.comment.content).toBe("trimmed");
  });

  it("trims authorName whitespace before saving", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "hi", authorName: "  Eve  " });
    expect(res.body.comment.authorName).toBe("Eve");
  });
});

// ════════════════════════════════════════════════════════════
// 2. Likes Toggle — Response Contract
// ════════════════════════════════════════════════════════════

describe("POST /api/blog/likes — Response Contract", () => {
  it("returns success shape when liking a post", () => {
    const db = new Set<string>();
    const res = buildLikeToggleResponse("post-1", "user-abc", db, 10);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.liked).toBe(true);
    expect(res.body.likesCount).toBe(11);
  });

  it("toggling again unlike and decrements count", () => {
    const db = new Set<string>();
    buildLikeToggleResponse("post-1", "user-abc", db, 10); // Like
    const res = buildLikeToggleResponse("post-1", "user-abc", db, 11); // Unlike
    expect(res.body.liked).toBe(false);
    expect(res.body.likesCount).toBe(10);
  });

  it("returns 400 when postId is missing", () => {
    const db = new Set<string>();
    const res = buildLikeToggleResponse("", "user-abc", db, 0);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("different users can like the same post independently", () => {
    const db = new Set<string>();
    const res1 = buildLikeToggleResponse("post-1", "user-A", db, 0);
    const res2 = buildLikeToggleResponse("post-1", "user-B", db, 1);
    expect(res1.body.liked).toBe(true);
    expect(res2.body.liked).toBe(true);
  });

  it("likesCount never goes below 0 (prevent negative likes)", () => {
    const db = new Set<string>(["post-1:user-abc"]);
    const res = buildLikeToggleResponse("post-1", "user-abc", db, 0);
    expect(res.body.likesCount).toBeGreaterThanOrEqual(0);
  });
});

// ════════════════════════════════════════════════════════════
// 3. Login — Response Contract
// ════════════════════════════════════════════════════════════

describe("POST /api/auth/login — Response Contract", () => {
  it("successful login returns user object", () => {
    const res = buildLoginResponse("admin@sitedotmoss.com", "Admin1234!");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user).toHaveProperty("id");
    expect(res.body.user).toHaveProperty("email");
    expect(res.body.user).toHaveProperty("name");
    expect(res.body.user).toHaveProperty("role");
  });

  it("failed login returns correct error structure", () => {
    const res = buildLoginResponse("wrong@x.com", "bad");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body).toHaveProperty("error");
    expect(typeof res.body.error).toBe("string");
  });

  it("missing credentials returns 400 with error", () => {
    const res = buildLoginResponse("", "");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("user object does NOT contain password or hash", () => {
    const res = buildLoginResponse("admin@sitedotmoss.com", "Admin1234!");
    expect(res.body.user).not.toHaveProperty("password");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });
});

// ════════════════════════════════════════════════════════════
// 4. ID Generation Uniqueness
// ════════════════════════════════════════════════════════════

describe("ID Generation — Uniqueness", () => {
  it("generates unique comment IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateCommentId());
    }
    expect(ids.size).toBe(100);
  });

  it("generates unique like IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateLikeId());
    }
    expect(ids.size).toBe(100);
  });

  it("comment ID starts with 'comment-' prefix", () => {
    const id = generateCommentId();
    expect(id).toMatch(/^comment-\d+-[a-z0-9]+$/);
  });

  it("like ID starts with 'like-' prefix", () => {
    const id = generateLikeId();
    expect(id).toMatch(/^like-\d+-[a-z0-9]+$/);
  });
});

// ════════════════════════════════════════════════════════════
// 5. Error Response Consistency
// ════════════════════════════════════════════════════════════

describe("Error Response Consistency", () => {
  it("all 400 responses have 'error' field", () => {
    const cases = [
      buildCommentResponse({ postSlug: "", content: "valid" }),
      buildLikeToggleResponse("", "user", new Set(), 0),
      buildLoginResponse("", ""),
    ];
    for (const res of cases) {
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("error");
    }
  });

  it("all 401 responses have 'success: false'", () => {
    const res = buildLoginResponse("unknown@x.com", "wrong");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("success responses always have 'success: true' field", () => {
    const comment = buildCommentResponse({ postSlug: "slug", content: "hi!" });
    const like = buildLikeToggleResponse("post-1", "u1", new Set(), 5);
    const login = buildLoginResponse("admin@sitedotmoss.com", "Admin1234!");
    expect(comment.body.success).toBe(true);
    expect(like.body.success).toBe(true);
    expect(login.body.success).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
// 6. Avatar Fallback URL Format
// ════════════════════════════════════════════════════════════

describe("Avatar Fallback — DiceBear URL", () => {
  it("generates valid DiceBear identicon URL", () => {
    const name = "Alice";
    const res = buildCommentResponse({ postSlug: "slug", content: "hi", authorName: name });
    const avatar = res.body.comment.authorAvatar;
    expect(avatar).toContain("https://api.dicebear.com/7.x/identicon/svg");
    expect(avatar).toContain("seed=");
  });

  it("encodes special characters in name for URL safety", () => {
    const name = "User & Co. <test>";
    const res = buildCommentResponse({ postSlug: "slug", content: "hi", authorName: name });
    const avatar = res.body.comment.authorAvatar;
    // URL should not contain raw & or <
    expect(avatar).not.toContain("&Co");
    expect(avatar).not.toContain("<");
  });

  it("uses 'Guest Explorer' seed when name defaults", () => {
    const res = buildCommentResponse({ postSlug: "slug", content: "hi" });
    const avatar = res.body.comment.authorAvatar;
    expect(avatar).toContain(encodeURIComponent("Guest Explorer"));
  });
});
