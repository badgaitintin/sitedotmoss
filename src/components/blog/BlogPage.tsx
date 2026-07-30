import React, { useState, useEffect } from "react";

// ─── Types ───
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
  createdAt: string | Date;
}

type FormData = {
  title: string;
  caption: string;
  coverImage: string;
  location: string;
  tags: string;
};

const emptyForm: FormData = {
  title: "",
  caption: "",
  coverImage: "",
  location: "",
  tags: "",
};

// ─── Main Component ───
export const BlogPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showLogin, setShowLogin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Post form
  const [form, setForm] = useState<FormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Message
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ─── Init: check auth + fetch public posts ───
  useEffect(() => {
    checkAuth();
    fetchPublicPosts();
  }, []);

  useEffect(() => {
    if (msg) {
      const t = setTimeout(() => setMsg(null), 3500);
      return () => clearTimeout(t);
    }
  }, [msg]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated) setIsAdmin(true);
    } catch {}
  };

  // Fetch posts from server-rendered page data endpoint
  const fetchPublicPosts = async () => {
    setLoading(true);
    try {
      // Use the posts API — this requires auth for GET, so we also
      // add a public endpoint fallback
      const res = await fetch("/api/blog/posts");
      const data = await res.json();
      if (data.success && data.posts) {
        setPosts(data.posts);
      }
    } catch {
      // silently fail — show empty
    } finally {
      setLoading(false);
    }
  };

  // ─── Auth ───
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setShowLogin(false);
        setPassword("");
        setMsg({ type: "ok", text: "Logged in" });
        fetchPublicPosts(); // refetch with admin context
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch {
      setLoginError("Connection error");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setIsAdmin(false);
    setMsg({ type: "ok", text: "Logged out" });
  };

  // ─── CRUD ───
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormLoading(true);

    const url = editingSlug ? `/api/blog/posts/${editingSlug}` : "/api/blog/posts";
    const method = editingSlug ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
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
        setMsg({ type: "ok", text: editingSlug ? "Post updated" : "Post created" });
        setShowForm(false);
        setEditingSlug(null);
        setForm(emptyForm);
        fetchPublicPosts();
      } else {
        setFormError(data.error || "Failed to save");
      }
    } catch {
      setFormError("Network error");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (slug: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/blog/posts/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "ok", text: "Post deleted" });
        fetchPublicPosts();
      } else {
        setMsg({ type: "err", text: data.error || "Delete failed" });
      }
    } catch {
      setMsg({ type: "err", text: "Network error" });
    }
  };

  const startEdit = (post: Post) => {
    setForm({
      title: post.title,
      caption: post.caption,
      coverImage: post.coverImage,
      location: post.location || "",
      tags: Array.isArray(post.tags) ? post.tags.join(", ") : "",
    });
    setEditingSlug(post.slug);
    setShowForm(true);
    setFormError("");
  };

  const startCreate = () => {
    setForm(emptyForm);
    setEditingSlug(null);
    setShowForm(true);
    setFormError("");
  };

  const fmtDate = (d: string | Date) => {
    try {
      const date = typeof d === "string" || typeof d === "number" ? new Date(d) : d;
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // ─── Render ───
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <a href="/" style={S.backLink}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            sitedotmoss
          </a>
          <span style={S.headerTitle}>Blog</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {isAdmin ? (
              <>
                <button type="button" onClick={startCreate} style={S.btnPrimary}>+ New Post</button>
                <button type="button" onClick={handleLogout} style={S.btnGhost}>Logout</button>
              </>
            ) : (
              <button type="button" onClick={() => setShowLogin(true)} style={S.btnOutline}>Admin Login</button>
            )}
          </div>
        </div>
      </header>

      {/* Toast */}
      {msg && (
        <div style={{
          position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", zIndex: 300,
          padding: "10px 20px", borderRadius: 6, fontSize: 13, fontWeight: 500,
          border: "1px solid",
          background: msg.type === "ok" ? "#f0fdf4" : "#fef2f2",
          color: msg.type === "ok" ? "#166534" : "#991b1b",
          borderColor: msg.type === "ok" ? "#bbf7d0" : "#fecaca",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}>
          {msg.text}
        </div>
      )}

      {/* Content */}
      <main style={S.main}>
        {loading ? (
          <div style={S.empty}><p style={S.emptyTitle}>Loading...</p></div>
        ) : posts.length === 0 ? (
          <div style={S.empty}>
            <p style={S.emptyTitle}>No posts yet</p>
            <p style={S.emptyDesc}>
              {isAdmin ? 'Click "+ New Post" to create your first post.' : "Nothing here yet."}
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {posts.map((post) => (
              <article key={post.id} style={S.card}>
                {post.coverImage && (
                  <div style={S.cardImgWrap}>
                    <img src={post.coverImage} alt={post.title} style={S.cardImg} loading="lazy" />
                  </div>
                )}
                <div style={S.cardBody}>
                  <h2 style={S.cardTitle}>{post.title}</h2>
                  <p style={S.cardCaption}>{post.caption}</p>
                  <div style={S.cardMeta}>
                    {post.location && <span>{post.location}</span>}
                    <span>{fmtDate(post.createdAt)}</span>
                    {!post.published && <span style={{ color: "#b45309", fontWeight: 600 }}>Draft</span>}
                  </div>
                  {post.tags && post.tags.length > 0 && (
                    <div style={S.tagRow}>
                      {post.tags.map((t) => <span key={t} style={S.tag}>#{t}</span>)}
                    </div>
                  )}
                  {isAdmin && (
                    <div style={S.cardActions}>
                      <button type="button" onClick={() => startEdit(post)} style={S.btnSm}>Edit</button>
                      <button type="button" onClick={() => handleDelete(post.slug, post.title)} style={S.btnSmDanger}>Delete</button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Login Modal */}
      {showLogin && (
        <div style={S.overlay} onClick={() => setShowLogin(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>Admin Login</h2>
              <button type="button" onClick={() => setShowLogin(false)} style={S.closeBtn} aria-label="Close">X</button>
            </div>
            {loginError && <div style={S.errBox}>{loginError}</div>}
            <form onSubmit={handleLogin} style={S.formCol}>
              <label style={S.label}>Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={S.input} required autoFocus />
              </label>
              <label style={S.label}>Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={S.input} required />
              </label>
              <button type="submit" style={S.btnPrimary} disabled={loginLoading}>
                {loginLoading ? "Logging in..." : "Login"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div style={S.overlay} onClick={() => { setShowForm(false); setEditingSlug(null); }}>
          <div style={{ ...S.modal, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHead}>
              <h2 style={S.modalTitle}>{editingSlug ? "Edit Post" : "New Post"}</h2>
              <button type="button" onClick={() => { setShowForm(false); setEditingSlug(null); }} style={S.closeBtn} aria-label="Close">X</button>
            </div>
            {formError && <div style={S.errBox}>{formError}</div>}
            <form onSubmit={handleSubmit} style={S.formCol}>
              <label style={S.label}>Title *
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={S.input} required autoFocus />
              </label>
              <label style={S.label}>Caption *
                <textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} style={{ ...S.input, minHeight: 90 }} required />
              </label>
              <label style={S.label}>Cover Image URL *
                <input type="url" value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })} style={S.input} placeholder="https://..." required />
              </label>
              {form.coverImage && (
                <img src={form.coverImage} alt="Preview" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 6 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <label style={S.label}>Location
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={S.input} placeholder="Bangkok, Thailand" />
              </label>
              <label style={S.label}>Tags (comma-separated)
                <input type="text" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} style={S.input} placeholder="webdev, ai, design" />
              </label>
              <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
                <button type="submit" style={S.btnPrimary} disabled={formLoading}>
                  {formLoading ? "Saving..." : editingSlug ? "Update" : "Publish"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingSlug(null); }} style={S.btnOutline}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Styles ───
const S: Record<string, React.CSSProperties> = {
  header: { position: "sticky", top: 0, zIndex: 50, background: "#fff", borderBottom: "1px solid #e5e7eb" },
  headerInner: { maxWidth: 960, margin: "0 auto", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  backLink: { display: "flex", alignItems: "center", gap: 8, color: "#111", textDecoration: "none", fontSize: 14, fontWeight: 500 },
  headerTitle: { fontSize: 18, fontWeight: 700, color: "#111" },
  main: { maxWidth: 960, margin: "0 auto", padding: "32px 24px 60px" },
  empty: { textAlign: "center", padding: "80px 20px" },
  emptyTitle: { fontSize: 18, fontWeight: 600, color: "#374151", margin: "0 0 8px" },
  emptyDesc: { fontSize: 14, color: "#9ca3af", margin: 0 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" },
  cardImgWrap: { width: "100%", height: 170, overflow: "hidden", background: "#f3f4f6" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  cardBody: { padding: "14px 16px 16px" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111", margin: "0 0 6px", lineHeight: 1.4 },
  cardCaption: { fontSize: 13, color: "#6b7280", lineHeight: 1.5, margin: "0 0 8px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any },
  cardMeta: { display: "flex", gap: 12, fontSize: 12, color: "#9ca3af", marginBottom: 6 },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 },
  tag: { fontSize: 11, color: "#6b7280", background: "#f3f4f6", padding: "2px 7px", borderRadius: 4 },
  cardActions: { display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid #f3f4f6" },
  btnPrimary: { padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "#111", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  btnOutline: { padding: "8px 20px", fontSize: 13, fontWeight: 600, background: "transparent", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  btnGhost: { padding: "8px 16px", fontSize: 13, fontWeight: 500, background: "transparent", color: "#6b7280", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" },
  btnSm: { padding: "4px 12px", fontSize: 12, fontWeight: 600, background: "#f3f4f6", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 5, cursor: "pointer", fontFamily: "inherit" },
  btnSmDanger: { padding: "4px 12px", fontSize: 12, fontWeight: 600, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 5, cursor: "pointer", fontFamily: "inherit" },
  overlay: { position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { background: "#fff", borderRadius: 10, width: "100%", maxWidth: 400, maxHeight: "90vh", overflowY: "auto", padding: "24px 28px 28px" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#111", margin: 0 },
  closeBtn: { background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, fontWeight: 700, padding: "4px 8px" },
  formCol: { display: "flex", flexDirection: "column", gap: 14 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600, color: "#374151" },
  input: { padding: "9px 12px", fontSize: 14, border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "inherit", outline: "none", color: "#111", background: "#fff" },
  errBox: { fontSize: 13, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 6, marginBottom: 12 },
};
