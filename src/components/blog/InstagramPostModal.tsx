import React, { useState, useEffect } from "react";
import { X, Heart, MessageCircle, Share2, MapPin, Send, Trash2, CornerDownRight } from "lucide-react";
import { ImageCarousel } from "./ImageCarousel";

export interface CommentData {
  id: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  parentId?: string | null;
  likesCount?: number;
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
  isLikedInitial?: boolean;
  visitorId?: string;
  visitorName?: string;
  onToggleLikeSuccess?: (postId: string, liked: boolean, count: number) => void;
}

export const InstagramPostModal: React.FC<ModalProps> = ({
  post,
  onClose,
  isLikedInitial = false,
  visitorId,
  visitorName,
  onToggleLikeSuccess,
}) => {
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [comments, setComments] = useState<CommentData[]>([]);
  
  // Author name input state with localStorage memory
  const [authorName, setAuthorName] = useState("");
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ id: string; authorName: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load saved author name from localStorage or props if available
    const savedName = visitorName || localStorage.getItem("blog_visitor_name") || localStorage.getItem("blog_author_name") || "";
    setAuthorName(savedName);
  }, [visitorName]);

  useEffect(() => {
    if (!post) return;
    setLikes(post.likesCount);
    setHasLiked(isLikedInitial);
    setComments(post.comments || []);
    setNewComment("");
    setReplyingTo(null);

    if (!post.comments) {
      fetch(`/api/blog/posts/${post.slug}`)
        .then(r => r.json())
        .then(d => { if (d.success && d.post) { setComments(d.post.comments || []); setLikes(d.post.likesCount); } })
        .catch(() => {});
    }
  }, [post, isLikedInitial]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!post) return null;

  const handleToggleLike = async () => {
    const currentVisitorId = visitorId || localStorage.getItem("blog_visitor_id") || "anon-user";
    const next = !hasLiked;
    setHasLiked(next);
    const optimisticCount = next ? likes + 1 : Math.max(0, likes - 1);
    setLikes(optimisticCount);
    onToggleLikeSuccess?.(post.id, next, optimisticCount);

    try {
      const res = await fetch("/api/blog/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, userHash: currentVisitorId }),
      });
      const d = await res.json();
      if (d.success) {
        setLikes(d.likesCount);
        setHasLiked(d.liked);
        onToggleLikeSuccess?.(post.id, d.liked, d.likesCount);
      }
    } catch {}
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAuthor = authorName.trim() || "Visitor";
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    // Save author name for future comments
    localStorage.setItem("blog_author_name", finalAuthor);

    try {
      const res = await fetch("/api/blog/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postSlug: post.slug,
          authorName: finalAuthor,
          content: newComment.trim(),
          parentId: replyingTo?.id || null,
        }),
      });
      const d = await res.json();
      if (d.success && d.comment) {
        setComments(prev => [d.comment, ...prev]);
        setNewComment("");
        setReplyingTo(null);
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    // Optimistic UI update
    setComments(prev =>
      prev.map(c => (c.id === commentId ? { ...c, likesCount: (c.likesCount || 0) + 1 } : c))
    );

    try {
      const res = await fetch("/api/blog/comments/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const d = await res.json();
      if (d.success) {
        setComments(prev =>
          prev.map(c => (c.id === commentId ? { ...c, likesCount: d.likesCount } : c))
        );
      }
    } catch (err) {
      console.error("Failed to like comment:", err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    // Optimistic delete
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentId !== commentId));

    try {
      await fetch(`/api/blog/comments/delete?id=${commentId}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  const fmtDate = (d: string | Date) => {
    try { return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
    catch { return ""; }
  };

  const fmtRelative = (d: string | Date) => {
    try {
      const diff = Date.now() - new Date(d).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d`;
      const weeks = Math.floor(days / 7);
      return `${weeks}w`;
    } catch { return ""; }
  };

  // Group top-level comments vs replies
  const topLevelComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="ig-modal-backdrop" onClick={onClose}>
      {/* Close Button */}
      <button className="ig-modal-close" onClick={onClose} aria-label="Close">
        <X size={24} />
      </button>

      <div className="ig-modal" onClick={e => e.stopPropagation()}>
        {/* ─── Image Side ─── */}
        <div className="ig-modal-image">
          <ImageCarousel
            images={post.images && post.images.length > 0 ? post.images : [post.coverImage]}
            altText={post.title}
            onDoubleTapLike={handleToggleLike}
          />
        </div>

        {/* ─── Content Side ─── */}
        <div className="ig-modal-content">
          {/* Header */}
          <div className="ig-modal-header">
            <div className="ig-avatar ig-avatar-gradient">M</div>
            <div style={{ flex: 1 }}>
              <div className="ig-modal-author-name">sitedotmoss</div>
              {post.location && (
                <div className="ig-modal-location">{post.location}</div>
              )}
            </div>
          </div>

          {/* Scrollable Body: Caption + Comments */}
          <div className="ig-modal-body">
            {/* Caption */}
            <div className="ig-caption">
              <div className="ig-avatar ig-avatar-gradient" style={{ width: 28, height: 28, fontSize: 11 }}>M</div>
              <div className="ig-caption-text">
                <strong>sitedotmoss</strong>
                {post.title !== post.caption && <strong style={{ display: "block", marginBottom: 4, fontWeight: 700 }}>{post.title}</strong>}
                {post.caption}
                {post.tags && post.tags.length > 0 && (
                  <div className="ig-caption-tags">
                    {post.tags.map(t => <span key={t} className="ig-tag">#{t}</span>)}
                  </div>
                )}
                <div className="ig-caption-time">{fmtRelative(post.createdAt)}</div>
              </div>
            </div>

            {/* Comments */}
            {comments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--ig-text)", marginBottom: 4 }}>No comments yet.</div>
                <div style={{ fontSize: 13, color: "var(--ig-text-secondary)" }}>Start the conversation.</div>
              </div>
            ) : (
              topLevelComments.map(c => {
                const replies = getReplies(c.id);
                return (
                  <div key={c.id} style={{ marginBottom: 16 }}>
                    {/* Top Level Comment */}
                    <div className="ig-comment">
                      <div className="ig-avatar" style={{ width: 28, height: 28, fontSize: 11, background: "rgba(0,0,0,0.08)", color: "var(--ig-text-secondary)" }}>
                        {c.authorName[0]?.toUpperCase() || "V"}
                      </div>
                      <div className="ig-comment-content">
                        <span className="ig-comment-author">{c.authorName}</span>
                        <span className="ig-comment-text">{c.content}</span>
                        <div className="ig-comment-meta">
                          <span>{fmtRelative(c.createdAt)}</span>
                          <button className="ig-comment-reply-btn" onClick={() => setReplyingTo({ id: c.id, authorName: c.authorName })}>
                            Reply
                          </button>
                          <button
                            onClick={() => handleLikeComment(c.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: "var(--ig-text-muted)", fontSize: 11 }}
                          >
                            <Heart size={12} fill={(c.likesCount || 0) > 0 ? "#e11d48" : "none"} color={(c.likesCount || 0) > 0 ? "#e11d48" : "currentColor"} />
                            {(c.likesCount || 0) > 0 && <span>{c.likesCount}</span>}
                          </button>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(225, 29, 72, 0.7)", padding: 0 }}
                            title="Delete comment"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Replies */}
                    {replies.map(reply => (
                      <div key={reply.id} className="ig-comment" style={{ marginLeft: 36, marginTop: 10 }}>
                        <div className="ig-avatar" style={{ width: 22, height: 22, fontSize: 10, background: "rgba(0,0,0,0.06)", color: "var(--ig-text-secondary)" }}>
                          {reply.authorName[0]?.toUpperCase() || "V"}
                        </div>
                        <div className="ig-comment-content">
                          <span className="ig-comment-author">{reply.authorName}</span>
                          <span className="ig-comment-text">{reply.content}</span>
                          <div className="ig-comment-meta">
                            <span>{fmtRelative(reply.createdAt)}</span>
                            <button
                              onClick={() => handleLikeComment(reply.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, color: "var(--ig-text-muted)", fontSize: 11 }}
                            >
                              <Heart size={11} fill={(reply.likesCount || 0) > 0 ? "#e11d48" : "none"} color={(reply.likesCount || 0) > 0 ? "#e11d48" : "currentColor"} />
                              {(reply.likesCount || 0) > 0 && <span>{reply.likesCount}</span>}
                            </button>
                            <button
                              onClick={() => handleDeleteComment(reply.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(225, 29, 72, 0.7)", padding: 0 }}
                              title="Delete reply"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Action Bar */}
          <div className="ig-modal-actions">
            <div className="ig-action-icons">
              <div className="ig-action-left">
                <button className={`ig-action-btn ${hasLiked ? "liked" : ""}`} onClick={handleToggleLike}>
                  <Heart size={24} fill={hasLiked ? "currentColor" : "none"} />
                </button>
                <button className="ig-action-btn">
                  <MessageCircle size={24} />
                </button>
                <button className="ig-action-btn" onClick={() => navigator.clipboard.writeText(window.location.origin + "/blog/" + post.slug)}>
                  <Share2 size={24} />
                </button>
              </div>
            </div>
            <div className="ig-likes-count">{likes.toLocaleString()} {likes === 1 ? "like" : "likes"}</div>
            <div className="ig-post-date">{fmtDate(post.createdAt)}</div>
          </div>

          {/* Replying Notice Banner */}
          {replyingTo && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 16px", background: "rgba(15, 23, 42, 0.06)", borderTop: "1px solid var(--ig-border)",
              fontSize: 12, color: "var(--ig-text-secondary)", fontWeight: 500
            }}>
              <span>Replying to <strong style={{ color: "var(--ig-text)" }}>@{replyingTo.authorName}</strong></span>
              <button
                onClick={() => setReplyingTo(null)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ig-text-muted)", padding: 2 }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Comment Form */}
          <form className="ig-comment-form" onSubmit={handleAddComment} style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ig-comment-input"
                type="text"
                placeholder="Your Name (e.g. Alex)"
                value={authorName}
                onChange={e => setAuthorName(e.target.value)}
                style={{ fontSize: 12, padding: "4px 8px", background: "rgba(0,0,0,0.04)", borderRadius: 6, width: "120px", flexShrink: 0 }}
              />
              <input
                className="ig-comment-input"
                type="text"
                placeholder={replyingTo ? `Reply to @${replyingTo.authorName}...` : "Add a comment..."}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="ig-comment-submit" disabled={!newComment.trim() || isSubmitting}>
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
