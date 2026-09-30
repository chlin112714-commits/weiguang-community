import { useEffect, useState } from "react";

import { apiRequest } from "../api";
import { formatTime } from "../utils";
import Avatar from "./Avatar";

export default function CommentSection({
  post,
  currentUser,
  onCommentCountChange,
  onRequireAuth,
  onOpenProfile,
  showMessage,
}) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const data = await apiRequest(`/api/posts/${post.id}/comments`);
        if (active) {
          setComments(data);
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
  }, [post.id, showMessage]);

  async function submit(event) {
    event.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    if (!draft.trim()) {
      return;
    }

    setBusy("create");
    try {
      const comment = await apiRequest(`/api/posts/${post.id}/comments`, {
        method: "POST",
        body: { content: draft },
      });
      setComments((current) => [...current, comment]);
      setDraft("");
      onCommentCountChange(1);
      showMessage("评论已发布");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  async function remove(comment) {
    if (!window.confirm("确定删除这条评论吗？")) {
      return;
    }
    setBusy(`delete-${comment.id}`);
    try {
      await apiRequest(`/api/comments/${comment.id}`, { method: "DELETE" });
      setComments((current) =>
        current.filter((item) => item.id !== comment.id),
      );
      onCommentCountChange(-1);
      showMessage("评论已删除");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  async function saveEdit() {
    if (!editing?.content.trim()) {
      return;
    }
    setBusy(`edit-${editing.id}`);
    try {
      const updated = await apiRequest(`/api/comments/${editing.id}`, {
        method: "PATCH",
        body: { content: editing.content },
      });
      setComments((current) =>
        current.map((comment) =>
          comment.id === updated.id ? updated : comment,
        ),
      );
      setEditing(null);
      showMessage("评论已更新");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="comment-section">
      {isLoading ? (
        <p className="comment-state">正在加载评论...</p>
      ) : comments.length === 0 ? (
        <p className="comment-state">还没有评论，来留下第一句回应吧。</p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <article className="comment" key={comment.id}>
              <Avatar
                author={comment.author}
                small
                onClick={
                  comment.author.username
                    ? () => onOpenProfile(comment.author.username)
                    : null
                }
              />
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{comment.author.display_name}</strong>
                  <span>{formatTime(comment.created_at)}</span>
                </div>

                {editing?.id === comment.id ? (
                  <div className="inline-editor compact">
                    <textarea
                      value={editing.content}
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          content: event.target.value,
                        }))
                      }
                      maxLength={500}
                      rows={3}
                    />
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
                        onClick={saveEdit}
                        disabled={busy === `edit-${comment.id}`}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <p>{comment.content}</p>
                )}

                {(comment.can_edit || comment.can_delete) &&
                  editing?.id !== comment.id && (
                    <div className="comment-actions">
                      {comment.can_edit && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: comment.id,
                              content: comment.content,
                            })
                          }
                        >
                          编辑
                        </button>
                      )}
                      {comment.can_delete && (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={() => remove(comment)}
                          disabled={busy === `delete-${comment.id}`}
                        >
                          删除
                        </button>
                      )}
                    </div>
                  )}
              </div>
            </article>
          ))}
        </div>
      )}

      {currentUser ? (
        <form className="comment-form" onSubmit={submit}>
          <Avatar author={currentUser} small />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={500}
            placeholder="写一句回应..."
            required
          />
          <button
            className="button button-dark button-small"
            type="submit"
            disabled={busy === "create"}
          >
            发送
          </button>
        </form>
      ) : (
        <button
          className="comment-login-link button-link"
          type="button"
          onClick={onRequireAuth}
        >
          登录后参与评论
        </button>
      )}
    </section>
  );
}
