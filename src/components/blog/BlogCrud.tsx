import React, { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, ArrowLeft, Upload, Link as LinkIcon, Image as ImageIcon, CheckCircle, X, AlertCircle, Eye, Heart } from "lucide-react";

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
  images: string[];
  location: string;
  tags: string;
  published: boolean;
};

const emptyForm: FormData = {
  title: "",
  caption: "",
  images: [],
  location: "Bangkok, Thailand",
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
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [urlInputError, setUrlInputError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setError("Connection error during login");
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
        setPosts(data.posts.map((p: any) => ({
          ...p,
          images: typeof p.images === "string" ? JSON.parse(p.images) : (p.images || [p.coverImage]),
          tags: typeof p.tags === "string" ? JSON.parse(p.tags) : (p.tags || []),
        })));
      } else {
        setError(data.error);
      }
    } catch {
      setError("Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  // ── Image Resizing & Compression (Max 720p) ──
  const resizeImageTo720p = (file: File, maxDim = 720, quality = 0.85): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(e.target?.result as string);

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP format for optimal compression & speed
          try {
            const webpUrl = canvas.toDataURL("image/webp", quality);
            if (webpUrl.startsWith("data:image/webp")) {
              return resolve(webpUrl);
            }
          } catch {}

          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // ── Image Handling (Max 5) ──
  const handleAddImageUrl = () => {
    setUrlInputError("");
    const url = imageUrlInput.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("data:image/")) {
      setUrlInputError("URL must start with http:// or https://");
      return;
    }
    if (form.images.length >= 5) {
      setUrlInputError("Maximum 5 images allowed per post");
      return;
    }
    setForm(prev => ({ ...prev, images: [...prev.images, url] }));
    setImageUrlInput("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlInputError("");
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - form.images.length;
    if (remainingSlots <= 0) {
      setUrlInputError("Maximum 5 images allowed per post");
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    for (const file of filesToProcess) {
      try {
        const resizedDataUrl = await resizeImageTo720p(file);
        setForm(prev => {
          if (prev.images.length >= 5) return prev;
          return { ...prev, images: [...prev.images, resizedDataUrl] };
        });
      } catch (err) {
        console.error("Error resizing image:", err);
      }
    }

    e.target.value = "";
  };

  const handleRemoveImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  // ── Form Actions ──
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.images.length === 0) {
      setMessage({ type: "error", text: "Please add at least 1 image for the post" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const coverImage = form.images[0];
      const res = await fetch("/api/blog/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          caption: form.caption.trim(),
          coverImage,
          images: form.images,
          location: form.location.trim(),
          tags: form.tags,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Post published successfully!" });
        setForm(emptyForm);
        setMode("list");
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create post" });
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
    if (form.images.length === 0) {
      setMessage({ type: "error", text: "Please add at least 1 image for the post" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const coverImage = form.images[0];
      const res = await fetch(`/api/blog/posts/${editingSlug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          caption: form.caption.trim(),
          coverImage,
          images: form.images,
          location: form.location.trim(),
          tags: form.tags,
          published: form.published,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Post updated successfully!" });
        setMode("list");
        setEditingSlug(null);
        setForm(emptyForm);
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to update post" });
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
        setMessage({ type: "success", text: "Post deleted" });
        fetchPosts();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
  };

  const startEdit = (post: Post) => {
    const postImgs = post.images && post.images.length > 0 ? post.images : [post.coverImage];
    setForm({
      title: post.title,
      caption: post.caption,
      images: postImgs.filter(Boolean),
      location: post.location || "Bangkok, Thailand",
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

  // ─── LOGIN VIEW ───
  if (!isLoggedIn) {
    return (
      <div style={S.container}>
        <div style={S.loginCard}>
          <h1 style={S.loginTitle}>Admin Login</h1>
          <p style={S.loginSub}>Enter credentials to access blog dashboard</p>
          {error && <div style={S.errorBox}>{error}</div>}
          <form onSubmit={handleLogin} style={S.formCol}>
            <label style={S.label}>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={S.input}
                required
              />
            </label>
            <label style={S.label}>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={S.input}
                required
              />
            </label>
            <button type="submit" style={S.btnPrimary} disabled={authLoading}>
              {authLoading ? "Logging in..." : "Log In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ───
  return (
    <div style={S.container}>
      {/* Action Header */}
      <div style={S.topBar}>
        <div>
          <h1 style={S.pageTitle}>Blog Dashboard</h1>
          <p style={S.pageSub}>Manage journal entries, photos & publishing status</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {mode !== "list" && (
            <button onClick={() => { setMode("list"); setMessage(null); }} style={S.btnOutline}>
              <ArrowLeft size={16} /> Back to List
            </button>
          )}
          {mode === "list" && (
            <button onClick={startCreate} style={S.btnPrimary}>
              <Plus size={16} /> New Entry
            </button>
          )}
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div style={message.type === "success" ? S.successBox : S.errorBox}>
          {message.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {mode === "list" && (
        <>
          {loading ? (
            <div style={S.emptyBox}><p>Loading entries...</p></div>
          ) : posts.length === 0 ? (
            <div style={S.emptyBox}>
              <p style={{ fontWeight: 600, fontSize: 16, margin: "0 0 6px" }}>No journal entries yet</p>
              <p style={{ color: "var(--ig-text-secondary)", margin: 0 }}>Click "+ New Entry" to create your first post.</p>
            </div>
          ) : (
            <div style={S.tableCard}>
              <div style={S.tableHeader}>
                <span style={{ flex: "0 0 70px" }}>Cover</span>
                <span style={{ flex: 2 }}>Title & Slug</span>
                <span style={{ flex: 1 }}>Location</span>
                <span style={{ width: 80, textAlign: "center" }}>Photos</span>
                <span style={{ width: 90, textAlign: "center" }}>Status</span>
                <span style={{ width: 60, textAlign: "center", display: "inline-flex", justifyContent: "center" }}><Heart size={14} /></span>
                <span style={{ width: 60, textAlign: "center", display: "inline-flex", justifyContent: "center" }}><Eye size={14} /></span>
                <span style={{ width: 140, textAlign: "right" }}>Actions</span>
              </div>
              {posts.map((post) => (
                <div key={post.id} style={S.tableRow}>
                  <div style={{ flex: "0 0 70px" }}>
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", display: "block" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <span style={{ flex: 2, fontWeight: 600 }}>
                    {post.title}
                    <div style={{ fontSize: 11, color: "var(--ig-text-muted)", fontWeight: 400, marginTop: 2 }}>
                      /{post.slug}
                    </div>
                  </span>
                  <span style={{ flex: 1, color: "var(--ig-text-secondary)", fontSize: 13 }}>{post.location || "—"}</span>
                  <span style={{ width: 80, textAlign: "center", fontSize: 13, color: "var(--ig-text-secondary)", fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <ImageIcon size={13} /> {post.images?.length || 1}
                  </span>
                  <span style={{ width: 90, textAlign: "center" }}>
                    <span style={{
                      ...S.badge,
                      background: post.published ? "rgba(34, 197, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
                      color: post.published ? "#15803d" : "#a16207",
                    }}>
                      {post.published ? "Published" : "Draft"}
                    </span>
                  </span>
                  <span style={{ width: 60, textAlign: "center", color: "var(--ig-text-secondary)", fontSize: 13 }}>{post.likesCount}</span>
                  <span style={{ width: 60, textAlign: "center", color: "var(--ig-text-secondary)", fontSize: 13 }}>{post.viewsCount}</span>
                  <span style={{ width: 140, textAlign: "right", display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => startEdit(post)} style={S.btnSm}>
                      <Edit3 size={13} /> Edit
                    </button>
                    <button onClick={() => handleDelete(post.slug)} style={S.btnSmDanger}>
                      <Trash2 size={13} />
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
        <form onSubmit={mode === "create" ? handleCreate : handleUpdate} style={S.formCard}>
          <h2 style={S.formTitle}>
            {mode === "create" ? "Create New Entry" : `Edit: ${editingSlug}`}
          </h2>

          <label style={S.label}>
            Title *
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={S.input}
              placeholder="Post title..."
              required
            />
          </label>

          <label style={S.label}>
            Caption / Content *
            <textarea
              value={form.caption}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              style={{ ...S.input, minHeight: 120, resize: "vertical" }}
              placeholder="Write entry caption..."
              required
            />
          </label>

          {/* ── Multi-Image Manager (Max 5) ── */}
          <div style={S.imageSection}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={{ ...S.label, margin: 0 }}>
                Images ({form.images.length}/5) *
              </label>
              <span style={{ fontSize: 12, color: "var(--ig-text-muted)" }}>
                First photo is the primary cover image
              </span>
            </div>

            {urlInputError && <div style={S.errorBox}>{urlInputError}</div>}

            {/* Input controls */}
            {form.images.length < 5 && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {/* URL Input */}
                <div style={{ display: "flex", flex: 1, minWidth: 260, gap: 6 }}>
                  <input
                    type="text"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddImageUrl(); } }}
                    style={{ ...S.input, flex: 1 }}
                    placeholder="Paste image URL (https://...)"
                  />
                  <button type="button" onClick={handleAddImageUrl} style={S.btnOutline}>
                    <LinkIcon size={14} /> Add URL
                  </button>
                </div>

                {/* Upload File Input */}
                <label style={S.btnOutline}>
                  <Upload size={14} /> Upload File(s)
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            )}

            {/* Thumbnails Preview Grid */}
            {form.images.length > 0 && (
              <div style={S.thumbnailGrid}>
                {form.images.map((imgUrl, idx) => (
                  <div key={idx} style={S.thumbnailItem}>
                    <img src={imgUrl} alt={`Image ${idx + 1}`} style={S.thumbnailImg} />
                    {idx === 0 && <span style={S.coverBadge}>Cover</span>}
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      style={S.removeImgBtn}
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={S.formRow}>
            <label style={S.label}>
              Location
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                style={S.input}
                placeholder="Bangkok, Thailand"
              />
            </label>

            <label style={S.label}>
              Tags (comma separated)
              <input
                type="text"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                style={S.input}
                placeholder="design, webdev, ai"
              />
            </label>
          </div>

          {mode === "edit" && (
            <label style={S.checkboxLabel}>
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
              />
              Published (visible to public)
            </label>
          )}

          <div style={S.formActions}>
            <button type="submit" style={S.btnPrimary} disabled={saving}>
              {saving ? "Saving..." : mode === "create" ? "Publish Entry" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("list"); setMessage(null); }}
              style={S.btnOutline}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// ─── Glassmorphism Styles (matching Frutiger/CV theme) ───
const S: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1040,
    margin: "0 auto",
    padding: "32px 24px",
    fontFamily: '"Google Sans Flex", -apple-system, sans-serif',
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--ig-text)",
    margin: 0,
  },
  pageSub: {
    fontSize: 13,
    color: "var(--ig-text-muted)",
    margin: "4px 0 0",
  },
  loginCard: {
    maxWidth: 380,
    margin: "80px auto",
    padding: "36px 32px",
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(20px)",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.8)",
    boxShadow: "0 16px 40px rgba(0, 0, 0, 0.08)",
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ig-text)",
    margin: 0,
  },
  loginSub: {
    fontSize: 12,
    color: "var(--ig-text-muted)",
    margin: "4px 0 20px",
  },
  tableCard: {
    background: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(20px)",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.8)",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.04)",
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "14px 20px",
    background: "rgba(255, 255, 255, 0.5)",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--ig-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  },
  tableRow: {
    display: "flex",
    alignItems: "center",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(0,0,0,0.04)",
    fontSize: 14,
    transition: "background 0.15s",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 600,
  },
  emptyBox: {
    padding: "60px 20px",
    textAlign: "center",
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(12px)",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.8)",
  },
  formCard: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    background: "rgba(255, 255, 255, 0.9)",
    backdropFilter: "blur(20px)",
    borderRadius: 16,
    border: "1px solid rgba(255, 255, 255, 0.8)",
    boxShadow: "0 12px 36px rgba(0, 0, 0, 0.06)",
    padding: "28px 32px",
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--ig-text)",
    margin: "0 0 6px",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  formCol: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "var(--ig-text)",
  },
  input: {
    padding: "10px 14px",
    fontSize: 14,
    border: "1px solid rgba(0, 0, 0, 0.15)",
    borderRadius: 8,
    fontFamily: "inherit",
    outline: "none",
    background: "rgba(255, 255, 255, 0.8)",
    color: "var(--ig-text)",
    transition: "border-color 0.2s",
  },
  imageSection: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    padding: "16px 20px",
    background: "rgba(0, 0, 0, 0.02)",
    borderRadius: 12,
    border: "1px solid rgba(0, 0, 0, 0.06)",
  },
  thumbnailGrid: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 8,
  },
  thumbnailItem: {
    position: "relative",
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: "hidden",
    border: "2px solid rgba(255, 255, 255, 0.8)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
  },
  thumbnailImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  coverBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    background: "#0f172a",
    color: "#fff",
    fontSize: 9,
    fontWeight: 700,
    padding: "2px 6px",
    borderRadius: 4,
    textTransform: "uppercase",
  },
  removeImgBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    background: "rgba(225, 29, 72, 0.9)",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 14,
    fontWeight: 600,
    color: "var(--ig-text)",
    cursor: "pointer",
  },
  formActions: {
    display: "flex",
    gap: 12,
    paddingTop: 8,
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 22px",
    fontSize: 14,
    fontWeight: 600,
    background: "#0f172a",
    color: "#ffffff",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
  },
  btnOutline: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 18px",
    fontSize: 13,
    fontWeight: 600,
    background: "rgba(255, 255, 255, 0.8)",
    color: "var(--ig-text)",
    border: "1px solid rgba(0, 0, 0, 0.15)",
    borderRadius: 8,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnSm: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    background: "rgba(255, 255, 255, 0.8)",
    color: "var(--ig-text)",
    border: "1px solid rgba(0, 0, 0, 0.12)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  btnSmDanger: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "5px 12px",
    fontSize: 12,
    fontWeight: 600,
    background: "rgba(225, 29, 72, 0.1)",
    color: "#e11d48",
    border: "1px solid rgba(225, 29, 72, 0.2)",
    borderRadius: 6,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  successBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    background: "rgba(220, 252, 231, 0.9)",
    color: "#166534",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    border: "1px solid rgba(187, 247, 208, 0.8)",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "12px 18px",
    background: "rgba(254, 242, 242, 0.9)",
    color: "#991b1b",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 16,
    border: "1px solid rgba(254, 202, 202, 0.8)",
  },
};
