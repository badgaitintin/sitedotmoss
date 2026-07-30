import React, { useState, useEffect } from "react";
import { CheckCircle, MapPin, ExternalLink, LogIn, LogOut, Plus, X, Lock, Hash } from "lucide-react";

interface ProfileProps {
  totalPosts: number;
  totalLikes: number;
  totalViews: number;
  activeView: "grid" | "feed";
  onViewChange: (view: "grid" | "feed") => void;
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  allTags: string[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddPost: (newPost: any) => void;
}

export const BlogProfileHeader: React.FC<ProfileProps> = ({
  totalPosts,
  totalLikes,
  totalViews,
  activeView,
  onViewChange,
  selectedTag,
  onSelectTag,
  allTags,
  searchQuery,
  onSearchChange,
  onAddPost,
}) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Create post form state
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [imagesInput, setImagesInput] = useState("");
  const [locationInput, setLocationInput] = useState("Bangkok, Thailand");
  const [tagsInput, setTagsInput] = useState("");
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setIsAdmin(true);
        }
      })
      .catch((err) => console.error("Auth check failed:", err));
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsSubmittingLogin(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        setIsAdmin(true);
        setShowLoginModal(false);
        setPassword("");
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("Connection error during login");
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsAdmin(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!title.trim() || !caption.trim() || !coverImage.trim()) {
      setCreateError("Title, caption, and cover image URL are required");
      return;
    }

    setIsCreatingPost(true);

    const extraImages = imagesInput
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const allImages = extraImages.length > 0 ? [coverImage, ...extraImages] : [coverImage];

    const tagsArr = tagsInput
      .split(",")
      .map((s) => s.trim().replace(/^#/, ""))
      .filter((s) => s.length > 0);

    try {
      const res = await fetch("/api/blog/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          caption: caption.trim(),
          coverImage: coverImage.trim(),
          images: allImages,
          location: locationInput.trim() || "Bangkok, Thailand",
          tags: tagsArr,
        }),
      });

      const data = await res.json();
      if (data.success && data.post) {
        onAddPost(data.post);
        setShowCreateModal(false);
        setTitle("");
        setCaption("");
        setCoverImage("");
        setImagesInput("");
        setTagsInput("");
      } else {
        setCreateError(data.error || "Failed to create post");
      }
    } catch (err) {
      setCreateError("Error creating post");
    } finally {
      setIsCreatingPost(false);
    }
  };

  return (
    <>
      {/* ─── SPOTIFY LEFT SIDEBAR ─── */}
      <aside className="spotify-left-sidebar space-y-6">
        {/* Profile Card */}
        <div className="glass-panel-3d text-center space-y-4">
          <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--accent-sage)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 700, margin: "0 auto", border: "2px solid #ffffff", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
            M
          </div>

          <div>
            <h2 style={{ fontSize: "17px", fontWeight: 700, color: "var(--fg-color)", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
              sitedotmoss
              <CheckCircle size={16} style={{ color: "var(--accent-sage)" }} />
            </h2>
            <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginTop: "2px" }}>
              Creative Dev & AI
            </p>
            <div style={{ fontSize: "11px", color: "var(--fg-light)", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              <MapPin size={11} /> Bangkok, Thailand
            </div>
          </div>

          {/* Admin Buttons */}
          <div style={{ paddingTop: "14px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "8px" }}>
            {isAdmin ? (
              <>
                <button onClick={() => setShowCreateModal(true)} className="glass-btn-3d" style={{ justifyContent: "center" }}>
                  <Plus size={14} /> New Post
                </button>
                <button onClick={handleLogout} className="glass-btn-3d" style={{ justifyContent: "center", background: "rgba(255,255,255,0.4)" }}>
                  <LogOut size={12} /> Sign Out Admin
                </button>
              </>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="glass-btn-3d" style={{ justifyContent: "center" }}>
                <Lock size={12} /> Admin Login
              </button>
            )}
          </div>
        </div>

        {/* Categories Panel */}
        <div className="glass-panel-3d space-y-3">
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Hash size={13} /> Categories
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => onSelectTag(null)}
              className={`glass-pill ${selectedTag === null ? "active" : ""}`}
              style={{ width: "100%", textAlign: "left", borderRadius: "12px" }}
            >
              All Entries ({totalPosts})
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
                className={`glass-pill ${selectedTag === tag ? "active" : ""}`}
                style={{ width: "100%", textAlign: "left", borderRadius: "12px" }}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── ADMIN LOGIN MODAL ─── */}
      {showLoginModal && (
        <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div
            className="glass-panel-3d"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "32px",
              position: "relative",
              background: "rgba(255, 255, 255, 0.95)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowLoginModal(false)} className="modal-close" style={{ position: "absolute", top: "16px", right: "16px" }}>
              <X size={16} />
            </button>

            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border-top)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px",
                  color: "var(--fg-color)",
                }}
              >
                <Lock size={20} />
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--fg-color)" }}>Admin Login</h2>
              <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginTop: "4px" }}>
                Enter credentials to manage your journal
              </p>
            </div>

            {loginError && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#e11d48",
                  background: "rgba(225,29,72,0.1)",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  marginBottom: "16px",
                  textAlign: "center",
                }}
              >
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "6px" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="glass-input-3d"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input-3d"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <button type="submit" disabled={isSubmittingLogin} className="glass-btn-3d" style={{ width: "100%", justifyContent: "center", marginTop: "8px", padding: "11px" }}>
                {isSubmittingLogin ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── ADMIN CREATE POST MODAL ─── */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div
            className="glass-panel-3d no-scrollbar"
            style={{
              width: "100%",
              maxWidth: "540px",
              padding: "32px",
              position: "relative",
              maxHeight: "90vh",
              overflowY: "auto",
              background: "rgba(255, 255, 255, 0.95)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => setShowCreateModal(false)} className="modal-close" style={{ position: "absolute", top: "18px", right: "18px" }}>
              <X size={16} />
            </button>

            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--fg-color)", marginBottom: "4px" }}>
              Create New Entry
            </h2>
            <p style={{ fontSize: "12px", color: "var(--fg-muted)", marginBottom: "20px" }}>
              Publish a new post to your journal
            </p>

            {createError && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#e11d48",
                  background: "rgba(225,29,72,0.1)",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  marginBottom: "16px",
                }}
              >
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePostSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                  Title *
                </label>
                <input
                  type="text"
                  placeholder="Entry title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="glass-input-3d"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                  Cover Image URL *
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  className="glass-input-3d"
                  style={{ width: "100%" }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                  Additional Image URLs (1 per line)
                </label>
                <textarea
                  rows={2}
                  placeholder="https://..."
                  value={imagesInput}
                  onChange={(e) => setImagesInput(e.target.value)}
                  className="glass-input-3d"
                  style={{ width: "100%", height: "auto" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                  Content / Caption *
                </label>
                <textarea
                  rows={4}
                  placeholder="Write content..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="glass-input-3d"
                  style={{ width: "100%", height: "auto" }}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="glass-input-3d"
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", display: "block", marginBottom: "4px" }}>
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="webdev, design"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="glass-input-3d"
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <button type="submit" disabled={isCreatingPost} className="glass-btn-3d" style={{ width: "100%", justifyContent: "center", marginTop: "10px", padding: "11px" }}>
                {isCreatingPost ? "Publishing..." : "Publish Post"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
