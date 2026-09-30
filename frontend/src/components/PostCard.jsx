import { useState } from "react";

import { apiRequest } from "../api";
import { formatTime, parseTagsInput } from "../utils";
import Avatar, { AuthorBadge } from "./Avatar";
import CommentSection from "./CommentSection";

export default function PostCard({
  post,
  currentUser,
  detail = false,
  onPostUpdated,
  onPostDeleted,
  onLike,
  onTagClick,
  onOpenProfile,
  onOpenPost,
  onRequireAuth,
  showMessage,
}) {
  const [editing, setEditing] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState(detail);
  const [busy, setBusy] = useState("");
  const [commentCount, setCommentCount] = useState(post.comment_count);

  async function savePost() {
    if (!editing?.content.trim()) {
      return;
    }
    setBusy("edit");
    try {
      const updated = await apiRequest(`/api/posts/${post.id}`, {
        method: "PATCH",
        body: {
          content: editing.content,
          tags: parseTagsInput(editing.tags),
        },
      });
      setEditing(null);
      setCommentCount(updated.comment_count);
      onPostUpdated(updated);
      showMessage("帖子已更新");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  async function removePost() {
    if (!window.confirm("确定删除这条帖子吗？相关评论和点赞也会一起删除。")) {
      return;
    }
    setBusy("delete");
    try {
      await apiRequest(`/api/posts/${post.id}`, { method: "DELETE" });
      onPostDeleted(post.id);
      showMessage("帖子已删除");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  function changeCommentCount(delta) {
    setCommentCount((current) => Math.max(0, current + delta));
  }

  return (
    <article className={`post-card${detail ? " post-card-detail" : ""}`}>
      <header className="post-header">
        <Avatar
          author={post.author}
          onClick={
            post.author.username
              ? () => onOpenProfile(post.author.username)
              : null
          }
        />
        <div className="post-author">
          <div>
            {post.author.username ? (
              <button
                className="author-name-button"
                type="button"
                onClick={() => onOpenProfile(post.author.username)}
              >
                {post.author.display_name}
              </button>
            ) : (
              <strong>{post.author.display_name}</strong>
            )}
            <AuthorBadge author={post.author} />
          </div>
          <span>
            {post.author.username
              ? `@${post.author.username}`
              : "未登录时代留下的内容"}
          </span>
        </div>
        <time dateTime={post.created_at}>{formatTime(post.created_at)}</time>
      </header>

      {editing ? (
        <div className="inline-editor post-editor">
          <textarea
            value={editing.content}
            onChange={(event) =>
              setEditing((current) => ({
                ...current,
                content: event.target.value,
              }))
            }
            maxLength={2000}
            rows={5}
          />
          <label className="tag-input-label">
            标签
            <input
              value={editing.tags}
              onChange={(event) =>
                setEditing((current) => ({
                  ...current,
                  tags: event.target.value,
                }))
              }
              maxLength={120}
              placeholder="用空格或逗号分隔，最多 5 个"
            />
          </label>
          <div className="inline-actions">
            <button
              className="text-button"
              type="button"
              onClick={() => setEditing(null)}
            >
              取消
            </button>
            <button
              className="button button-dark button-small"
              type="button"
              onClick={savePost}
              disabled={busy === "edit"}
            >
              {busy === "edit" ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      ) : (
        <p className="post-content">{post.content}</p>
      )}

      {post.tags.length > 0 && !editing && (
        <div className="post-tags">
          {post.tags.map((tag) => (
            <button
              className="tag-chip"
              type="button"
              key={tag}
              onClick={() => onTagClick(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {post.updated_at !== post.created_at && !editing && (
        <p className="edited-note">内容已编辑</p>
      )}

      <footer className="post-footer">
        <div className="post-actions">
          <button
            className={`reaction-button${post.liked_by_me ? " active" : ""}`}
            type="button"
            onClick={() => onLike(post)}
            aria-pressed={post.liked_by_me}
          >
            <span>{post.liked_by_me ? "♥" : "♡"}</span>
            点赞 {post.like_count > 0 && post.like_count}
          </button>
          {!detail && (
            <button
              className={`reaction-button${commentsOpen ? " active" : ""}`}
              type="button"
              onClick={() => setCommentsOpen((current) => !current)}
            >
              <span>◌</span>
              评论 {commentCount > 0 && commentCount}
            </button>
          )}
          {!detail && (
            <button
              className="reaction-button detail-link"
              type="button"
              onClick={() => onOpenPost(post.id)}
            >
              <span>↗</span>
              查看详情
            </button>
          )}
        </div>

        {(post.can_edit || post.can_delete) && (
          <div className="owner-actions">
            {post.can_edit && (
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setEditing({
                    content: post.content,
                    tags: post.tags.join(" "),
                  })
                }
              >
                编辑
              </button>
            )}
            {post.can_delete && (
              <button
                className="text-button danger"
                type="button"
                onClick={removePost}
                disabled={busy === "delete"}
              >
                删除
              </button>
            )}
          </div>
        )}
      </footer>

      {commentsOpen && (
        <CommentSection
          post={{ ...post, comment_count: commentCount }}
          currentUser={currentUser}
          onCommentCountChange={changeCommentCount}
          onRequireAuth={onRequireAuth}
          onOpenProfile={onOpenProfile}
          showMessage={showMessage}
        />
      )}
    </article>
  );
}
