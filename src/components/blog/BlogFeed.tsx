import React, { useState, useMemo, useEffect } from "react";
import { InstagramPostModal, type PostDetailData } from "./InstagramPostModal";
import {
  Heart, MessageCircle, Layers, Search, Plus, X, Home, Compass,
  LogIn, LogOut, Settings, Camera, Pencil, Trash2, User, UserCheck, Sparkles
} from "lucide-react";

interface BlogFeedProps {
  initialPosts: PostDetailData[];
}

export const BlogFeed: React.FC<BlogFeedProps> = ({ initialPosts }) => {
  const [posts, setPosts] = useState<PostDetailData[]>(initialPosts);
  const [selectedPost, setSelectedPost] = useState<PostDetailData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Anonymous Visitor Profile state
  const [visitorId, setVisitorId] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorNameInput, setVisitorNameInput] = useState("");
  const [likedPostIds, setLikedPostIds] = useState<string[]>([]);

  // Login modal
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: "", caption: "", coverImage: "", images: "", location: "Bangkok, Thailand", tags: "" });
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Check admin session & setup visitor profile
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => { if (d.authenticated) setIsAdmin(true); }).catch(() => {});

    let vid = localStorage.getItem("blog_visitor_id");
    if (!vid) {
      vid = `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem("blog_visitor_id", vid);
    }
    setVisitorId(vid);

    const vname = localStorage.getItem("blog_visitor_name") || localStorage.getItem("blog_author_name") || "";
    if (vname) {
      setVisitorName(vname);
      setVisitorNameInput(vname);
    } else {
      setShowVisitorModal(true);
    }

    // Fetch liked posts for this visitor
    fetch(`/api/blog/likes?userHash=${vid}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.likedPostIds)) {
          setLikedPostIds(d.likedPostIds);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }
  }, [toast]);

  // ── Visitor Profile Save Handler ──
  const handleSaveVisitorName = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = visitorNameInput.trim() || `Explorer_${Math.floor(100 + Math.random() * 900)}`;
    setVisitorName(finalName);
    setVisitorNameInput(finalName);
    localStorage.setItem("blog_visitor_name", finalName);
    localStorage.setItem("blog_author_name", finalName);
    setShowVisitorModal(false);
    setToast({ type: "ok", text: `Profile updated: ${finalName}` });
  };

  // ── Like Success Callback ──
  const handleToggleLikeSuccess = (postId: string, liked: boolean, count: number) => {
    setLikedPostIds(prev =>
      liked ? Array.from(new Set([...prev, postId])) : prev.filter(id => id !== postId)
    );
    setPosts(prev =>
      prev.map(p => (p.id === postId ? { ...p, likesCount: count } : p))
    );
  };

  // ── Tags ──
  const allTags = useMemo(() => {
    const s = new Set<string>();
    posts.forEach(p => p.tags?.forEach(t => s.add(t)));
    return Array.from(s).sort();
  }, [posts]);

  // ── Filter ──
  const filteredPosts = useMemo(() => {
    let r = [...posts];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter(p => p.title.toLowerCase().includes(q) || p.caption.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    if (selectedTag) r = r.filter(p => p.tags?.includes(selectedTag));
    return r;
  }, [posts, searchQuery, selectedTag]);

  // ── Auth ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (d.success) { setIsAdmin(true); setShowLogin(false); setPassword(""); setToast({ type: "ok", text: "Logged in" }); refetchPosts(); }
      else setLoginError(d.error || "Login failed");
    } catch { setLoginError("Connection error"); }
    finally { setLoginLoading(false); }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setIsAdmin(false);
    setToast({ type: "ok", text: "Logged out" });
  };

  // ── CRUD ──
  const refetchPosts = async () => {
    try {
      const res = await fetch("/api/blog/posts");
      const d = await res.json();
      if (d.success && d.posts) {
        setPosts(d.posts.map((p: any) => ({
          ...p,
          images: typeof p.images === "string" ? JSON.parse(p.images) : (p.images || [p.coverImage]),
          tags: typeof p.tags === "string" ? JSON.parse(p.tags) : (p.tags || []),
          comments: p.comments || [],
        })));
      }
    } catch {}
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.title.trim() || !createForm.caption.trim() || !createForm.coverImage.trim()) {
      setCreateError("Title, caption, and cover image are required");
      return;
    }
    setCreateLoading(true);
    const extraImgs = createForm.images.split("\n").map(s => s.trim()).filter(Boolean);
    const allImgs = extraImgs.length > 0 ? [createForm.coverImage, ...extraImgs] : [createForm.coverImage];
    const tagsArr = createForm.tags.split(",").map(s => s.trim().replace(/^#/, "")).filter(Boolean);
    try {
      const res = await fetch("/api/blog/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: createForm.title.trim(), caption: createForm.caption.trim(), coverImage: createForm.coverImage.trim(), images: allImgs, location: createForm.location.trim(), tags: tagsArr }),
      });
      const d = await res.json();
      if (d.success) { setShowCreate(false); setCreateForm({ title: "", caption: "", coverImage: "", images: "", location: "Bangkok, Thailand", tags: "" }); setToast({ type: "ok", text: "Post published!" }); refetchPosts(); }
      else setCreateError(d.error || "Failed");
    } catch { setCreateError("Network error"); }
    finally { setCreateLoading(false); }
  };

  const handleDelete = async (slug: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      const res = await fetch(`/api/blog/posts/${slug}`, { method: "DELETE" });
      const d = await res.json();
      if (d.success) { setPosts(prev => prev.filter(p => p.slug !== slug)); setToast({ type: "ok", text: "Deleted" }); }
      else setToast({ type: "err", text: d.error || "Failed" });
    } catch { setToast({ type: "err", text: "Network error" }); }
  };

  return (
    <div className="ig-root">
      {/* ─── LEFT SIDEBAR ─── */}
      <nav className="ig-sidebar">
        <div className="ig-nav-logo">
          <svg className="ig-nav-logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="ig-nav-logo-text">Journal</span>
        </div>

        <div className="ig-nav-items">
          <a href="/" className="ig-nav-item">
            <Home size={20} />
            <span className="ig-nav-label">Back to Home</span>
          </a>
          <button className="ig-nav-item active" onClick={() => { setSearchQuery(""); setSelectedTag(null); }}>
            <Compass size={20} />
            <span className="ig-nav-label">Feed</span>
          </button>
          {isAdmin && (
            <button className="ig-nav-item" onClick={() => setShowCreate(true)}>
              <Plus size={20} />
              <span className="ig-nav-label">Create Entry</span>
            </button>
          )}
        </div>

        <div className="ig-nav-bottom">
          {/* Visitor Profile Badge */}
          <button
            className="ig-nav-item"
            onClick={() => { setVisitorNameInput(visitorName); setShowVisitorModal(true); }}
            title="Click to edit your display name"
            style={{ background: "rgba(0,0,0,0.04)" }}
          >
            <div className="ig-avatar ig-avatar-gradient" style={{ width: 22, height: 22, fontSize: 10 }}>
              {visitorName[0]?.toUpperCase() || "G"}
            </div>
            <span className="ig-nav-label" style={{ fontSize: 13, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {visitorName || "Guest Explorer"}
            </span>
          </button>

          {isAdmin ? (
            <>
              <a href="/blog/admin" className="ig-nav-item">
                <Settings size={20} />
                <span className="ig-nav-label">Admin Panel</span>
              </a>
              <button className="ig-nav-item" onClick={handleLogout}>
                <LogOut size={20} />
                <span className="ig-nav-label">Log Out</span>
              </button>
            </>
          ) : (
            <button className="ig-nav-item" onClick={() => setShowLogin(true)}>
              <LogIn size={20} />
              <span className="ig-nav-label">Admin Login</span>
            </button>
          )}
        </div>
      </nav>

      {/* ─── MAIN CONTENT ─── */}
      <main className="ig-main">
        <div className="ig-grid-container">
          {/* Search */}
          <div className="ig-search-bar">
            <div className="ig-search-input-wrap">
              <Search size={14} className="ig-search-icon" />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="ig-search-input"
              />
            </div>
          </div>

          {/* Tag Filter Pills */}
          {allTags.length > 0 && (
            <div className="ig-tag-pills">
              {selectedTag && (
                <button className="ig-tag-pill" onClick={() => setSelectedTag(null)}>
                  <X size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Clear
                </button>
              )}
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`ig-tag-pill ${selectedTag === tag ? "active" : ""}`}
                  onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {filteredPosts.length === 0 ? (
            <div className="ig-empty">
              <div className="ig-empty-icon">
                <Camera size={30} />
              </div>
              <h3>{searchQuery || selectedTag ? "No Results" : "No Posts Yet"}</h3>
              <p>{searchQuery || selectedTag ? "Try different keywords or tags" : isAdmin ? "Click + to create your first post" : "Check back soon!"}</p>
            </div>
          ) : (
            <div className="ig-grid">
              {filteredPosts.map(post => {
                const hasMulti = post.images && post.images.length > 1;
                const isLiked = likedPostIds.includes(post.id);
                return (
                  <article
                    key={post.id}
                    className="ig-grid-item"
                    onClick={() => setSelectedPost(post)}
                  >
                    <img src={post.coverImage} alt={post.title} loading="lazy" />

                    {hasMulti && (
                      <div className="ig-multi-badge">
                        <Layers size={18} />
                      </div>
                    )}

                    <div className="ig-grid-overlay">
                      <span className="ig-grid-overlay-stat">
                        <Heart size={18} fill={isLiked ? "#e11d48" : "white"} color={isLiked ? "#e11d48" : "white"} /> {post.likesCount || 0}
                      </span>
                      <span className="ig-grid-overlay-stat">
                        <MessageCircle size={18} fill="white" /> {post.comments?.length || 0}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="ig-admin-actions">
                        <button className="ig-admin-btn ig-admin-btn-edit" onClick={(e) => { e.stopPropagation(); window.location.href = "/blog/admin"; }}>
                          <Pencil size={10} />
                        </button>
                        <button className="ig-admin-btn ig-admin-btn-delete" onClick={(e) => handleDelete(post.slug, post.title, e)}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── MOBILE BOTTOM NAV ─── */}
      <div className="ig-mobile-nav">
        <a href="/"><Home size={24} /></a>
        <button onClick={() => { setSearchQuery(""); setSelectedTag(null); }}><Compass size={24} /></button>
        {isAdmin && <button onClick={() => setShowCreate(true)}><Plus size={24} /></button>}
        {isAdmin
          ? <button onClick={handleLogout}><LogOut size={24} /></button>
          : <button onClick={() => setShowLogin(true)}><LogIn size={24} /></button>
        }
      </div>

      {/* ─── TOAST ─── */}
      {toast && <div className="ig-toast">{toast.text}</div>}

      {/* ─── ANONYMOUS VISITOR SETUP MODAL ─── */}
      {showVisitorModal && (
        <div className="ig-login-modal" onClick={() => visitorName && setShowVisitorModal(false)}>
          <div className="ig-login-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg, #0f172a, #334155)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <User size={24} />
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>Set Your Display Name</h2>
            <p style={{ fontSize: 13, color: "var(--ig-text-secondary)", margin: "0 0 20px" }}>
              Enter a name to use when liking posts and joining comment discussions.
            </p>
            <form onSubmit={handleSaveVisitorName}>
              <input
                type="text"
                placeholder="e.g. Alex Explorer"
                value={visitorNameInput}
                onChange={e => setVisitorNameInput(e.target.value)}
                autoFocus
                required
                style={{ fontSize: 14, padding: "10px 14px", marginBottom: 16 }}
              />
              <button type="submit" className="ig-btn-primary">
                Save & Continue
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── LOGIN MODAL ─── */}
      {showLogin && (
        <div className="ig-login-modal" onClick={() => setShowLogin(false)}>
          <div className="ig-login-card" onClick={e => e.stopPropagation()}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 16px", display: "block", color: "#a8a8a8" }}>
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="5" />
              <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
            </svg>
            <h2>Admin Login</h2>
            {loginError && <div className="ig-login-error">{loginError}</div>}
            <form onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
              <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="submit" className="ig-btn-primary" disabled={loginLoading}>
                {loginLoading ? "Logging in..." : "Log In"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── CREATE POST MODAL ─── */}
      {showCreate && (
        <div className="ig-login-modal" onClick={() => setShowCreate(false)}>
          <div className="ig-create-modal-inner" onClick={e => e.stopPropagation()}>
            <button className="ig-modal-x" onClick={() => setShowCreate(false)}><X size={18} /></button>
            <h2>Create new post</h2>
            {createError && <div className="ig-login-error" style={{ textAlign: "left" }}>{createError}</div>}
            <form onSubmit={handleCreate}>
              <div className="ig-form-group">
                <label className="ig-form-label">Title *</label>
                <input className="ig-form-input" type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} placeholder="Post title..." required />
              </div>
              <div className="ig-form-group">
                <label className="ig-form-label">Cover Image URL *</label>
                <input className="ig-form-input" type="url" value={createForm.coverImage} onChange={e => setCreateForm({ ...createForm, coverImage: e.target.value })} placeholder="https://..." required />
              </div>
              {createForm.coverImage && (
                <div style={{ marginBottom: 14, borderRadius: 8, overflow: "hidden", maxHeight: 180 }}>
                  <img src={createForm.coverImage} alt="Preview" style={{ width: "100%", objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
              )}
              <div className="ig-form-group">
                <label className="ig-form-label">Additional Images (1 per line)</label>
                <textarea className="ig-form-input ig-form-textarea" value={createForm.images} onChange={e => setCreateForm({ ...createForm, images: e.target.value })} placeholder="https://..." rows={2} />
              </div>
              <div className="ig-form-group">
                <label className="ig-form-label">Caption *</label>
                <textarea className="ig-form-input ig-form-textarea" value={createForm.caption} onChange={e => setCreateForm({ ...createForm, caption: e.target.value })} placeholder="Write a caption..." required rows={3} />
              </div>
              <div className="ig-form-row">
                <div className="ig-form-group">
                  <label className="ig-form-label">Location</label>
                  <input className="ig-form-input" type="text" value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })} />
                </div>
                <div className="ig-form-group">
                  <label className="ig-form-label">Tags (comma separated)</label>
                  <input className="ig-form-input" type="text" value={createForm.tags} onChange={e => setCreateForm({ ...createForm, tags: e.target.value })} placeholder="design, code" />
                </div>
              </div>
              <button type="submit" className="ig-btn-primary" disabled={createLoading}>
                {createLoading ? "Sharing..." : "Share"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── POST DETAIL MODAL ─── */}
      <InstagramPostModal
        post={selectedPost}
        onClose={() => setSelectedPost(null)}
        isLikedInitial={selectedPost ? likedPostIds.includes(selectedPost.id) : false}
        visitorId={visitorId}
        visitorName={visitorName}
        onToggleLikeSuccess={handleToggleLikeSuccess}
      />
    </div>
  );
};
