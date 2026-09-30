import { useEffect, useState } from "react";

import { apiRequest } from "../api";
import { formatDate } from "../utils";
import Avatar from "./Avatar";
import PostCard from "./PostCard";

export default function ProfilePage({
  username,
  currentUser,
  onBack,
  onOpenPost,
  onOpenProfile,
  onTagClick,
  onRequireAuth,
  onCurrentUserUpdated,
  showMessage,
}) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ display_name: "", bio: "" });
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      try {
        const data = await apiRequest(`/api/users/${encodeURIComponent(username)}`);
        if (active) {
          setProfile(data);
          setForm({
            display_name: data.user.display_name,
            bio: data.user.bio ?? "",
          });
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
  }, [username]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy("profile");
    try {
      const updated = await apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: form,
      });
      setProfile((current) => ({
        ...current,
        user: updated,
        posts: current.posts.map((post) =>
          post.author.id === updated.id
            ? {
                ...post,
                author: { ...post.author, display_name: updated.display_name },
              }
            : post,
        ),
      }));
      setEditing(false);
      onCurrentUserUpdated(updated);
      showMessage("个人资料已更新");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  async function toggleLike(post) {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      const result = await apiRequest(`/api/posts/${post.id}/like`, {
        method: "POST",
      });
      setProfile((current) => ({
        ...current,
        received_like_count: Math.max(
          0,
          current.received_like_count + (result.liked ? 1 : -1),
        ),
        posts: current.posts.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: result.liked,
                like_count: result.like_count,
              }
            : item,
        ),
      }));
    } catch (error) {
      showMessage(error.message, "error");
    }
  }

  function updatePost(updated) {
    setProfile((current) => ({
      ...current,
      posts: current.posts.map((post) =>
        post.id === updated.id ? updated : post,
      ),
    }));
  }

  function deletePost(postId) {
    setProfile((current) => ({
      ...current,
      post_count: Math.max(0, current.post_count - 1),
      posts: current.posts.filter((post) => post.id !== postId),
    }));
  }

  if (isLoading) {
    return (
      <section className="view-page">
        <div className="profile-hero skeleton-card">
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="view-page">
        <div className="empty-state">
          <strong>这个用户不存在</strong>
          <button className="button button-light" type="button" onClick={onBack}>
            返回社区
          </button>
        </div>
      </section>
    );
  }

  const isOwner = currentUser?.username === profile.user.username;

  return (
    <section className="view-page">
      <button className="back-button" type="button" onClick={onBack}>
        ← 返回社区动态
      </button>

      <div className="profile-hero">
        <div className="profile-avatar-wrap">
          <Avatar author={profile.user} />
        </div>
        <div className="profile-main">
          <div className="profile-title-row">
            <div>
              <span className="section-label">
                {profile.user.role === "admin" ? "社区管理员" : "社区成员"}
              </span>
              <h1>{profile.user.display_name}</h1>
              <p>@{profile.user.username}</p>
            </div>
            {isOwner && !editing && (
              <button
                className="button button-light button-small"
                type="button"
                onClick={() => setEditing(true)}
              >
                编辑简介
              </button>
            )}
          </div>

          {editing ? (
            <form className="profile-editor" onSubmit={saveProfile}>
              <label>
                显示昵称
                <input
                  value={form.display_name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      display_name: event.target.value,
                    }))
                  }
                  maxLength={30}
                  required
                />
              </label>
              <label>
                个人简介
                <textarea
                  value={form.bio}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      bio: event.target.value,
                    }))
                  }
                  maxLength={160}
                  rows={3}
                  placeholder="介绍一下自己，最多 160 字"
                />
              </label>
              <div className="inline-actions">
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setEditing(false)}
                >
                  取消
                </button>
                <button
                  className="button button-dark button-small"
                  type="submit"
                  disabled={busy === "profile"}
                >
                  保存资料
                </button>
              </div>
            </form>
          ) : (
            <p className="profile-bio">
              {profile.user.bio || "这个人还没有写下简介。"}
            </p>
          )}

          <div className="profile-stats">
            <div>
              <strong>{profile.post_count}</strong>
              <span>发布帖子</span>
            </div>
            <div>
              <strong>{profile.received_like_count}</strong>
              <span>收到点赞</span>
            </div>
            <div>
              <strong>{profile.comment_count}</strong>
              <span>参与评论</span>
            </div>
            <div>
              <strong>{formatDate(profile.user.created_at)}</strong>
              <span>加入社区</span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-feed-heading">
        <div>
          <span className="section-label">公开内容</span>
          <h2>{profile.user.display_name} 的帖子</h2>
        </div>
        <span>{profile.post_count} 条</span>
      </div>

      {profile.posts.length === 0 ? (
        <div className="empty-state">
          <strong>还没有发布帖子</strong>
          <p>这个人的第一束微光还在路上。</p>
        </div>
      ) : (
        <div className="post-stack">
          {profile.posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onPostUpdated={updatePost}
              onPostDeleted={deletePost}
              onLike={toggleLike}
              onTagClick={onTagClick}
              onOpenProfile={onOpenProfile}
              onOpenPost={onOpenPost}
              onRequireAuth={onRequireAuth}
              showMessage={showMessage}
            />
          ))}
        </div>
      )}
    </section>
  );
}

