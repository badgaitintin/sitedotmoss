import React, { useState, useEffect } from "react";
import { X, Heart, MessageCircle, Share2, Bookmark, MapPin, Send } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";

export interface CommentData {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: string | Date;
}

export interface PostDetailData {
  id: string;
  slug: string;
  title: string;
  caption: string;
  coverImage: string;
  images: string[];
  location?: string;
  tags: string[];
  likesCount: number;
  viewsCount: number;
  createdAt: string | Date;
  comments?: CommentData[];
}

interface ModalProps {
  post: PostDetailData | null;
  onClose: () => void;
}

export const InstagramPostModal: React.FC<ModalProps> = ({ post, onClose }) => {
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!post) return;
    setLikes(post.likesCount);
    setHasLiked(false);
    setComments(post.comments || []);
    setNewCommentText("");

    if (!post.comments) {
      fetch(`/api/blog/posts/${post.slug}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.post) {
            setComments(data.post.comments || []);
            setLikes(data.post.likesCount);
          }
        })
        .catch((err) => console.error("Failed to load post detail:", err));
    }
  }, [post]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!post) return null;

  const handleToggleLike = async () => {
    const next = !hasLiked;
    setHasLiked(next);
    setLikes((prev) => (next ? prev + 1 : Math.max(0, prev - 1)));
    try {
      const res = await fetch("/api/blog/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, userHash: "browser-visitor" }),
      });
      const data = await res.json();
      if (data.success) {
        setLikes(data.likesCount);
        setHasLiked(data.liked);
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postSlug: post.slug,
          authorName: "Visitor",
          content: newCommentText.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setComments((prev) => [data.comment, ...prev]);
        setNewCommentText("");
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="glass-panel-3d"
        style={{
          width: "100%",
          maxWidth: "960px",
          maxHeight: "88vh",
          padding: 0,
          overflow: "hidden",
          display: "flex",
          flexDirection: "row",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="modal-close"
          style={{ position: "absolute", top: "14px", right: "14px", zIndex: 30 }}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>

        {/* Left Image Section */}
        <div style={{ width: "55%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyCenter: "center" }}>
          <ImageCarousel
            images={post.images && post.images.length > 0 ? post.images : [post.coverImage]}
            altText={post.title}
            onDoubleTapLike={handleToggleLike}
          />
        </div>

        {/* Right Info Section */}
        <div style={{ width: "45%", display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.3)" }}>
          {/* Header */}
          <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--accent-sage)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "14px" }}>
              M
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--fg-color)" }}>sitedotmoss</div>
              {post.location && (
                <div style={{ fontSize: "11px", color: "var(--fg-muted)", display: "flex", alignItems: "center", gap: "3px" }}>
                  <MapPin size={10} /> {post.location}
                </div>
              )}
            </div>
          </div>

          {/* Scrollable Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px" }} className="no-scrollbar space-y-4">
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--fg-color)" }}>{post.title}</h3>
            <p style={{ fontSize: "13px", color: "var(--fg-color)", lineHeight: 1.6, whitespace: "pre-line" }}>
              {post.caption}
            </p>

            {post.tags && post.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "6px" }}>
                {post.tags.map((t) => (
                  <span key={t} className="glass-pill">#{t}</span>
                ))}
              </div>
            )}

            <hr style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.06)", margin: "16px 0" }} />

            {/* Comments List */}
            <div className="space-y-3">
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--fg-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Comments ({comments.length})
              </div>

              {comments.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--fg-light)", fontStyle: "italic" }}>No comments yet.</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: "rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "11px" }}>
                      {comment.authorName[0]?.toUpperCase() || "V"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 700, color: "var(--fg-color)", marginRight: "6px" }}>{comment.authorName}</span>
                      <span style={{ color: "var(--fg-color)" }}>{comment.content}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Action Bar */}
          <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.4)" }} className="space-y-3">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <button
                  onClick={handleToggleLike}
                  style={{ background: "none", border: "none", cursor: "pointer", color: hasLiked ? "#e11d48" : "var(--fg-color)" }}
                >
                  <Heart size={22} fill={hasLiked ? "currentColor" : "none"} />
                </button>
                <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-color)" }}>
                  <MessageCircle size={22} />
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.origin + "/blog/" + post.slug);
                  }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--fg-color)" }}
                >
                  <Share2 size={22} />
                </button>
              </div>
              <Bookmark size={22} style={{ color: "var(--fg-color)", cursor: "pointer" }} />
            </div>

            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--fg-color)" }}>
              {likes} {likes === 1 ? "like" : "likes"}
            </div>

            <form onSubmit={handleAddComment} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="Add a comment..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="glass-input-3d"
                style={{ flex: 1, padding: "8px 12px", fontSize: "12px" }}
              />
              <button
                type="submit"
                disabled={!newCommentText.trim() || isSubmitting}
                className="glass-btn-3d"
                style={{ padding: "6px 14px", fontSize: "12px" }}
              >
                Post <Send size={12} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
