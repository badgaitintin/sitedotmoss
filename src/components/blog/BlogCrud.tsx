import React, { useState, useEffect } from "react";

interface Post {
  id: string;
  title: string;
  slug: string;
  caption: string;
  coverImage: string;
  images: string[];
  location: string;
  tags: string[];
  likesCount: number;
  viewsCount: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

type FormData = {
  title: string;
  caption: string;
  coverImage: string;
  location: string;
  tags: string;
  published: boolean;
};

const emptyForm: FormData = {
  title: "",
  caption: "",
  coverImage: "",
  location: "",
  tags: "",
  published: true,
};

export const BlogCrud: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Auth state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // CRUD state
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) {
        setIsLoggedIn(true);
        fetchPosts();
      } else {
        setIsLoggedIn(false);
        setLoading(false);
      }
    } catch {
      setIsLoggedIn(false);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsLoggedIn(true);
        fetchPosts();
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog/posts");
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/blog/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          caption: form.caption,
          coverImage: form.coverImage,
          location: form.location,
          tags: form.tags,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Post created!" });
        setForm(emptyForm);
        setMode("list");
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSlug) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/blog/posts/${editingSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          caption: form.caption,
          coverImage: form.coverImage,
          location: form.location,
          tags: form.tags,
          published: form.published,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Post updated!" });
        setMode("list");
        setEditingSlug(null);
        setForm(emptyForm);
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm(`Delete post "${slug}"?`)) return;
    try {
      const res = await fetch(`/api/blog/posts/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Post deleted!" });
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const startEdit = (post: Post) => {
    setForm({
      title: post.title,
      caption: post.caption,
      coverImage: post.coverImage,
      location: post.location || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
      published: post.published,
    });
    setEditingSlug(post.slug);
    setMode("edit");
    setMessage(null);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setEditingSlug(null);
    setMode("create");
    setMessage(null);
  };

  // ─── Login form ───
  if (!isLoggedIn) {
    return (
      <div style={styles.container}>
        <div style={styles.loginCard}>
          <h1 style={styles.pageTitle}>🔐 Admin Login</h1>
          {error && <div style={styles.errorMsg}>{error}</div>}
          <form onSubmit={handleLogin} style={styles.form}>
            <label style={styles.label}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <label style={styles.label}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </label>
            <button type="submit" style={styles.btnPrimary} disabled={authLoading}>
              {authLoading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── Main CRUD UI ───
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>📝 Blog Admin</h1>
        <div style={styles.headerActions}>
          {mode !== "list" && (
            <button
              onClick={() => { setMode("list"); setMessage(null); }}
              style={styles.btnSecondary}
            >
              ← Back to List
            </button>
          )}
          {mode === "list" && (
            <button onClick={startCreate} style={styles.btnPrimary}>
              + New Post
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={message.type === "success" ? styles.successMsg : styles.errorMsg}>
          {message.text}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {mode === "list" && (
        <>
          {loading ? (
            <p style={styles.muted}>Loading posts...</p>
          ) : posts.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.muted}>No posts yet. Create your first post!</p>
            </div>
          ) : (
            <div style={styles.table}>
              <div style={styles.tableHeader}>
                <span style={{ flex: 2 }}>Title</span>
                <span style={{ flex: 1 }}>Location</span>
                <span style={{ width: 80, textAlign: "center" }}>Status</span>
                <span style={{ width: 60, textAlign: "center" }}>❤️</span>
                <span style={{ width: 60, textAlign: "center" }}>👁️</span>
                <span style={{ width: 160, textAlign: "right" }}>Actions</span>
              </div>
              {posts.map((post) => (
                <div key={post.id} style={styles.tableRow}>
                  <span style={{ flex: 2, fontWeight: 600 }}>
                    {post.title}
                    <div style={{ fontSize: 11, color: "#888", fontWeight: 400, marginTop: 2 }}>
                      /{post.slug}
                    </div>
                  </span>
                  <span style={{ flex: 1, color: "#666" }}>{post.location || "—"}</span>
                  <span style={{ width: 80, textAlign: "center" }}>
                    <span style={{
                      ...styles.badge,
                      background: post.published ? "#dcfce7" : "#fef3c7",
                      color: post.published ? "#166534" : "#92400e",
                    }}>
                      {post.published ? "Published" : "Draft"}
                    </span>
                  </span>
                  <span style={{ width: 60, textAlign: "center", color: "#666" }}>{post.likesCount}</span>
                  <span style={{ width: 60, textAlign: "center", color: "#666" }}>{post.viewsCount}</span>
                  <span style={{ width: 160, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => startEdit(post)} style={styles.btnSmall}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(post.slug)} style={styles.btnSmallDanger}>
                      Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── CREATE / EDIT FORM ─── */}
      {(mode === "create" || mode === "edit") && (
        <form onSubmit={mode === "create" ? handleCreate : handleUpdate} style={styles.form}>
          <h2 style={styles.formTitle}>
            {mode === "create" ? "Create New Post" : `Edit: ${editingSlug}`}
          </h2>

          <label style={styles.label}>
            Title *
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={styles.input}
              required
            />
          </label>

          <label style={styles.label}>
            Caption *
            <textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              style={{ ...styles.input, minHeight: 100, resize: "vertical" }}
              required
            />
          </label>

          <label style={styles.label}>
            Cover Image URL *
            <input
              type="url"
              value={form.coverImage}
              onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
              style={styles.input}
              placeholder="https://..."
              required
            />
          </label>

          {form.coverImage && (
            <div style={styles.imagePreview}>
              <img
                src={form.coverImage}
                alt="Preview"
                style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, objectFit: "cover" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          )}

          <label style={styles.label}>
            Location
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              style={styles.input}
              placeholder="Bangkok, Thailand"
            />
          </label>

          <label style={styles.label}>
            Tags (comma-separated)
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              style={styles.input}
              placeholder="webdev, ai, design"
            />
          </label>

          {mode === "edit" && (
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Published
            </label>
          )}

          <div style={styles.formActions}>
            <button type="submit" style={styles.btnPrimary} disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Create Post" : "Update Post"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("list"); setMessage(null); }}
              style={styles.btnSecondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// ─── Inline styles (simple, no framework) ───
const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 20px",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  loginCard: {
    maxWidth: 400,
    margin: "80px auto",
    padding: 32,
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerActions: {
    display: "flex",
    gap: 8,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1a1410",
    margin: 0,
  },
  muted: {
    color: "#888",
    fontSize: 14,
  },
  emptyState: {
    padding: "60px 0",
    textAlign: "center" as const,
  },

  // Table
  table: {
    background: "#fff",
    borderRadius: 12,
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "12px 20px",
    background: "#f8f7f5",
    fontSize: 12,
    fontWeight: 600,
    color: "#888",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    borderBottom: "1px solid #eee",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid #f3f2f0",
    fontSize: 14,
    transition: "background 0.15s",
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
  },

  // Form
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 16,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a1410",
    marginBottom: 8,
  },
  label: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
  },
  input: {
    padding: "10px 14px",
    fontSize: 14,
    border: "1px solid #ddd",
    borderRadius: 8,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    outline: "none",
    transition: "border-color 0.2s",
    color: "#1a1410",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 500,
    color: "#555",
    cursor: "pointer",
  },
  formActions: {
    display: "flex",
    gap: 12,
    paddingTop: 8,
  },
  imagePreview: {
    padding: 8,
    background: "#f8f7f5",
    borderRadius: 8,
    display: "flex",
    justifyContent: "center" as const,
  },

  // Buttons
  btnPrimary: {
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    background: "#1a1410",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    transition: "opacity 0.2s",
  },
  btnSecondary: {
    padding: "10px 24px",
    fontSize: 14,
    fontWeight: 600,
    background: "#f3f2f0",
    color: "#1a1410",
    border: "1px solid #ddd",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  btnSmall: {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    background: "#f3f2f0",
    color: "#1a1410",
    border: "1px solid #ddd",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  btnSmallDanger: {
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: 600,
    background: "#fef2f2",
    color: "#dc2626",
    border: "1px solid #fecaca",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  // Messages
  successMsg: {
    padding: "10px 16px",
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  },
  errorMsg: {
    padding: "10px 16px",
    background: "#fef2f2",
    color: "#dc2626",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 16,
  },
};
