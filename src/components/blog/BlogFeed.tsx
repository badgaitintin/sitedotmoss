import React, { useState, useMemo } from "react";
import { BlogProfileHeader } from "./BlogProfileHeader";
import { InstagramPostModal, type PostDetailData } from "./InstagramPostModal";
import { Heart, MessageCircle, Layers, MapPin, Share2, Bookmark, Search, LayoutGrid, AlignJustify, ExternalLink, Sparkles, Plus } from "lucide-react";

interface BlogFeedProps {
  initialPosts: PostDetailData[];
}

export const BlogFeed: React.FC<BlogFeedProps> = ({ initialPosts }) => {
  const [posts, setPosts] = useState<PostDetailData[]>(initialPosts);
  const [activeView, setActiveView] = useState<"grid" | "feed">("grid");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPost, setSelectedPost] = useState<PostDetailData | null>(null);

  const handleAddPost = (newPost: PostDetailData) => {
    setPosts((prev) => [newPost, ...prev]);
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => p.tags?.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [posts]);

  const totalLikes = useMemo(() => posts.reduce((s, p) => s + (p.likesCount || 0), 0), [posts]);
  const totalViews = useMemo(() => posts.reduce((s, p) => s + (p.viewsCount || 0), 0), [posts]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.caption.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (selectedTag) {
      result = result.filter((p) => p.tags?.includes(selectedTag));
    }
    return result;
  }, [posts, searchQuery, selectedTag]);

  const featuredPost = filteredPosts[0];
  const gridPosts = featuredPost ? filteredPosts.slice(1) : filteredPosts;

  return (
    <div className="spotify-layout-root">
      {/* ─── LEFT SIDEBAR ─── */}
      <BlogProfileHeader
        totalPosts={posts.length}
        totalLikes={totalLikes}
        totalViews={totalViews}
        activeView={activeView}
        onViewChange={setActiveView}
        selectedTag={selectedTag}
        onSelectTag={setSelectedTag}
        allTags={allTags}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddPost={handleAddPost}
      />

      {/* ─── MAIN DASHBOARD CONTENT AREA ─── */}
      <main className="space-y-6" style={{ minWidth: 0 }}>
        {/* Top Control Bar */}
        <div className="glass-panel-3d" style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--fg-light)" }} />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input-3d"
              style={{ width: "100%", paddingLeft: "38px" }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setActiveView("grid")}
              className={`glass-pill ${activeView === "grid" ? "active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              onClick={() => setActiveView("feed")}
              className={`glass-pill ${activeView === "feed" ? "active" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: "5px" }}
            >
              <AlignJustify size={13} /> Feed
            </button>
          </div>
        </div>

        {/* ─── FEATURED HERO CARD (IF POSTS EXIST) ─── */}
        {featuredPost && !searchQuery && !selectedTag && (
          <div
            className="glass-card-3d"
            onClick={() => setSelectedPost(featuredPost)}
            style={{
              position: "relative",
              overflow: "hidden",
              minHeight: "260px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            <img
              src={featuredPost.coverImage}
              alt={featuredPost.title}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.7) contrast(1.05)",
                transition: "transform 0.5s ease",
              }}
              className="hover:scale-105"
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(26,20,16,0.85) 100%)" }} />

            <div style={{ position: "relative", zIndex: 10, padding: "28px" }} className="space-y-3">
              <span className="glass-btn-3d" style={{ fontSize: "11px", padding: "4px 12px" }}>
                <Sparkles size={12} /> FEATURED ENTRY
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#ffffff", lineHeight: 1.35, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                {featuredPost.title}
              </h2>
              <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.9)", lineHeight: 1.6 }} className="line-clamp-2">
                {featuredPost.caption}
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingTop: "6px" }}>
                <span style={{ fontSize: "12px", color: "#ffffff", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px" }}>
                  <Heart size={14} fill="currentColor" style={{ color: "#e11d48" }} /> {featuredPost.likesCount}
                </span>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", display: "flex", alignItems: "center", gap: "5px" }}>
                  <MessageCircle size={14} /> {featuredPost.comments?.length || 0}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── MAIN CONTENT CARDS ─── */}
        {filteredPosts.length === 0 ? (
          <div className="glass-panel-3d text-center py-20 space-y-4">
            <div style={{ fontSize: "36px" }}>🌿</div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "var(--fg-color)" }}>No entries found</h3>
            <p style={{ fontSize: "13px", color: "var(--fg-muted)", maxWidth: "360px", margin: "0 auto" }}>
              There are no blog posts published yet. Log in as Admin to publish your first journal entry!
            </p>
          </div>
        ) : activeView === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "24px" }}>
            {gridPosts.map((post) => {
              const isMulti = post.images && post.images.length > 1;
              return (
                <div
                  key={post.id}
                  className="glass-card-3d"
                  onClick={() => setSelectedPost(post)}
                >
                  <div style={{ position: "relative", height: "190px", overflow: "hidden" }}>
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      loading="lazy"
                    />
                    {isMulti && (
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          right: "10px",
                          background: "rgba(255,255,255,0.8)",
                          backdropFilter: "blur(8px)",
                          padding: "3px 8px",
                          borderRadius: "99px",
                          fontSize: "10px",
                          color: "var(--fg-color)",
                          fontWeight: 600,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Layers size={10} /> {post.images.length}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "20px" }} className="space-y-2">
                    <h3 style={{ fontSize: "15px", fontWeight: 700, color: "var(--fg-color)", lineHeight: 1.4 }} className="line-clamp-2">
                      {post.title}
                    </h3>
                    <p style={{ fontSize: "12.5px", color: "var(--fg-muted)", lineHeight: 1.55 }} className="line-clamp-2">
                      {post.caption}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", paddingTop: "12px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                      <span style={{ fontSize: "12px", color: "var(--fg-color)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Heart size={13} fill="currentColor" style={{ color: "#e11d48" }} /> {post.likesCount}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--fg-light)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MessageCircle size={13} /> {post.comments?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vertical Feed View */
          <div className="space-y-5">
            {filteredPosts.map((post) => (
              <div key={post.id} className="glass-card-3d" style={{ padding: "20px" }}>
                <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
                  <div
                    style={{ width: "180px", height: "130px", borderRadius: "14px", overflow: "hidden", flexShrink: 0, cursor: "pointer" }}
                    onClick={() => setSelectedPost(post)}
                  >
                    <img src={post.coverImage} alt={post.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ flex: 1 }} className="space-y-2">
                    <h3
                      style={{ fontSize: "17px", fontWeight: 700, color: "var(--fg-color)", cursor: "pointer" }}
                      onClick={() => setSelectedPost(post)}
                    >
                      {post.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--fg-muted)", lineHeight: 1.6 }} className="line-clamp-2">
                      {post.caption}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingTop: "6px" }}>
                      <span style={{ fontSize: "12px", color: "var(--fg-color)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                        <Heart size={13} fill="currentColor" style={{ color: "#e11d48" }} /> {post.likesCount}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--fg-light)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MessageCircle size={13} /> {post.comments?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ─── RIGHT SIDEBAR (SPOTIFY WIDGETS) ─── */}
      <aside className="spotify-right-sidebar space-y-6">
        {/* Stats Panel */}
        <div className="glass-panel-3d space-y-3">
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
            Journal Stats
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div style={{ background: "rgba(255,255,255,0.4)", padding: "12px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.7)", textAlign: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--fg-color)", display: "block" }}>{posts.length}</span>
              <span style={{ fontSize: "10px", color: "var(--fg-light)", textTransform: "uppercase" }}>Entries</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.4)", padding: "12px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.7)", textAlign: "center" }}>
              <span style={{ fontSize: "20px", fontWeight: 700, color: "var(--fg-color)", display: "block" }}>{totalLikes}</span>
              <span style={{ fontSize: "10px", color: "var(--fg-light)", textTransform: "uppercase" }}>Total Likes</span>
            </div>
          </div>
        </div>

        {/* Creator Info Panel */}
        <div className="glass-panel-3d space-y-3">
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-muted)" }}>
            About Author
          </div>
          <p style={{ fontSize: "13px", color: "var(--fg-muted)", lineHeight: 1.6 }}>
            Personal portfolio journal by Moss. Code, AI research & design experiments.
          </p>
          <a
            href="https://sitedotmoss.com"
            target="_blank"
            rel="noreferrer"
            className="glass-btn-3d"
            style={{ width: "100%", justifyContent: "center", fontSize: "12px" }}
          >
            Visit sitedotmoss.com <ExternalLink size={12} />
          </a>
        </div>
      </aside>

      {/* Modal */}
      <InstagramPostModal post={selectedPost} onClose={() => setSelectedPost(null)} />
    </div>
  );
};
