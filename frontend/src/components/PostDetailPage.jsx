import { useEffect, useState } from "react";

import { apiRequest } from "../api";
import PostCard from "./PostCard";

export default function PostDetailPage({
  postId,
  currentUser,
  onBack,
  onOpenProfile,
  onTagClick,
  onRequireAuth,
  showMessage,
}) {
  const [post, setPost] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const data = await apiRequest(`/api/posts/${postId}`);
        if (active) {
          setPost(data);
        }
      } catch (error) {
        if (active) {
          showMessage(error.message, "error");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [postId]);

  async function toggleLike() {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const result = await apiRequest(`/api/posts/${postId}/like`, {
        method: "POST",
      });
      setPost((current) => ({
        ...current,
        liked_by_me: result.liked,
        like_count: result.like_count,
      }));
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  if (isLoading) {
    return (
      <section className="view-page">
        <div className="post-card skeleton-card detail-skeleton">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="view-page">
        <div className="empty-state">
          <strong>这条帖子不存在或已经被删除</strong>
          <button className="button button-light" type="button" onClick={onBack}>
            返回社区
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="view-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← 返回社区动态
      </button>
      <div className="view-heading">
        <span className="section-label">帖子详情</span>
        <h1>完整内容与回应</h1>
        <p>在一条清晰的线索里阅读内容、点赞并参与评论。</p>
      </div>

      <PostCard
        post={post}
        currentUser={currentUser}
        detail
        onPostUpdated={setPost}
        onPostDeleted={onBack}
        onLike={toggleLike}
        onTagClick={onTagClick}
        onOpenProfile={onOpenProfile}
        onOpenPost={() => {}}
        onRequireAuth={onRequireAuth}
        showMessage={showMessage}
      />
    </section>
  );
}
