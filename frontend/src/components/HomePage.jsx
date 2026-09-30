import { useEffect, useState } from "react";

import { apiRequest } from "../api";
import Avatar from "./Avatar";
import AuthPanel from "./AuthPanel";
import PostCard from "./PostCard";

export default function HomePage({
  currentUser,
  authMode,
  setAuthMode,
  authForm,
  onAuthFieldChange,
  onSubmitAuth,
  onLogout,
  authBusy,
  onOpenProfile,
  onOpenPost,
  onRequireAuth,
  showMessage,
  filterTag,
  onFilterTagChange,
}) {
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [composerTags, setComposerTags] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [busyAction, setBusyAction] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (query) {
        params.set("q", query);
      }
      if (filterTag) {
        params.set("tag", filterTag);
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";

      try {
        const data = await apiRequest(`/api/posts${suffix}`);
        if (active) {
          setPosts(data);
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

    loadPosts();
    return () => {
      active = false;
    };
  }, [query, filterTag, showMessage]);

  useEffect(() => {
    let active = true;

    async function loadTags() {
      try {
        const data = await apiRequest("/api/tags");
        if (active) {
          setTags(data);
        }
      } catch (error) {
        if (active) {
          showMessage(error.message, "error");
        }
      }
    }

    loadTags();
    return () => {
      active = false;
    };
  }, [showMessage]);

  const totalLikes = posts.reduce((total, post) => total + post.like_count, 0);
  const totalComments = posts.reduce(
    (total, post) => total + post.comment_count,
    0,
  );

  async function refreshTags() {
    try {
      setTags(await apiRequest("/api/tags"));
    } catch {
      // The feed remains usable even if the tag summary fails.
    }
  }

  async function publishPost(event) {
    event.preventDefault();
    if (!composer.trim()) {
      return;
    }
    setBusyAction("create-post");
    try {
      const newPost = await apiRequest("/api/posts", {
        method: "POST",
        body: {
          content: composer,
          tags: composerTags
            .split(/[\s,，#]+/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        },
      });
      setPosts((current) => [newPost, ...current]);
      setComposer("");
      setComposerTags("");
      refreshTags();
      showMessage("帖子已发布");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyAction("");
    }
  }

  async function toggleLike(post) {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setBusyAction(`like-${post.id}`);
    try {
      const result = await apiRequest(`/api/posts/${post.id}/like`, {
        method: "POST",
      });
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                liked_by_me: result.liked,
                like_count: result.like_count,
              }
            : item,
        ),
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setBusyAction("");
    }
  }

  function updatePost(updated) {
    setPosts((current) =>
      current.map((post) => (post.id === updated.id ? updated : post)),
    );
    refreshTags();
  }

  function deletePost(postId) {
    setPosts((current) => current.filter((post) => post.id !== postId));
    refreshTags();
  }

  function selectTag(tag) {
    onFilterTagChange(filterTag === tag ? "" : tag);
    window.setTimeout(() => {
      document.getElementById("feed")?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  }

  function clearFilters() {
    setSearchInput("");
    onFilterTagChange("");
  }

  return (
    <div className="home-view">
      <section className="hero" id="about">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" />
            REACT + FASTAPI + SQLITE
          </p>
          <h1>
            每一个想法，
            <br />
            都值得被看见。
          </h1>
          <p className="hero-description">
            分享此刻的心情、问题和灵感，也可以在标签和个人主页里找到同频的人。
          </p>
          <div className="hero-actions">
            <a className="button button-dark" href="#feed">
              浏览社区
            </a>
            {!currentUser && (
              <a className="button button-light" href="#join">
                创建账号
              </a>
            )}
          </div>
        </div>

        <div className="hero-panel">
          <p className="panel-kicker">当前搜索结果</p>
          <div className="pulse-number">{posts.length}</div>
          <p>{query || filterTag ? "条帖子符合当前条件" : "条公开帖子正在这里生长"}</p>
          <div className="pulse-grid">
            <div>
              <strong>{totalLikes}</strong>
              <span>收到点赞</span>
            </div>
            <div>
              <strong>{totalComments}</strong>
              <span>收到评论</span>
            </div>
          </div>
        </div>
      </section>

      <div className="community-layout">
        <aside className="left-rail">
          <AuthPanel
            currentUser={currentUser}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            onAuthFieldChange={onAuthFieldChange}
            onSubmit={onSubmitAuth}
            onLogout={onLogout}
            onOpenProfile={onOpenProfile}
            busy={authBusy}
          />

          <section className="side-card">
            <span className="section-label">社区公约</span>
            <h2>让表达有温度</h2>
            <ul className="rule-list">
              <li>友善交流，不攻击具体的人</li>
              <li>尊重隐私，不公开他人信息</li>
              <li>认真表达，不刷屏和恶意灌水</li>
            </ul>
          </section>
        </aside>

        <section className="feed" id="feed">
          <div className="feed-heading">
            <div>
              <span className="section-label">社区动态</span>
              <h2>最近有人在说</h2>
            </div>
            <span className="feed-count">{posts.length} 条帖子</span>
          </div>

          <div className="search-panel">
            <span className="search-icon" aria-hidden="true">
              ⌕
            </span>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              maxLength={60}
              placeholder="搜索帖子、作者或标签..."
              aria-label="搜索社区"
            />
            {(searchInput || filterTag) && (
              <button className="text-button" type="button" onClick={clearFilters}>
                清除
              </button>
            )}
          </div>

          {filterTag && (
            <div className="active-filter">
              <span>正在查看标签</span>
              <button
                className="tag-chip active"
                type="button"
                onClick={() => onFilterTagChange("")}
              >
                #{filterTag} ×
              </button>
            </div>
          )}

          {currentUser ? (
            <form className="composer" onSubmit={publishPost}>
              <Avatar author={currentUser} />
              <div className="composer-body">
                <textarea
                  value={composer}
                  onChange={(event) => setComposer(event.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder={`${currentUser.display_name}，此刻想分享什么？`}
                  required
                />
                <div className="composer-tags">
                  <label htmlFor="composer-tags">标签</label>
                  <input
                    id="composer-tags"
                    value={composerTags}
                    onChange={(event) => setComposerTags(event.target.value)}
                    maxLength={120}
                    placeholder="例如：生活 编程 电影"
                  />
                </div>
                <div className="composer-footer">
                  <span>{composer.length} / 2000</span>
                  <button
                    className="button button-dark"
                    type="submit"
                    disabled={busyAction === "create-post" || !composer.trim()}
                  >
                    {busyAction === "create-post" ? "正在发布..." : "发布帖子"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="locked-composer">
              <div className="locked-icon">+</div>
              <div>
                <strong>登录后分享你的想法</strong>
                <p>加入社区后即可发布帖子、点赞和评论。</p>
              </div>
              <button
                className="button button-light button-small"
                type="button"
                onClick={onRequireAuth}
              >
                去登录
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="post-stack" aria-label="正在加载帖子">
              {[1, 2, 3].map((item) => (
                <div className="post-card skeleton-card" key={item}>
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="empty-state">
              <strong>没有找到符合条件的帖子</strong>
              <p>可以换一个关键词，或者清除标签后重新看看。</p>
              {(query || filterTag) && (
                <button
                  className="button button-light button-small"
                  type="button"
                  onClick={clearFilters}
                >
                  查看全部帖子
                </button>
              )}
            </div>
          ) : (
            <div className="post-stack">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUser={currentUser}
                  onPostUpdated={updatePost}
                  onPostDeleted={deletePost}
                  onLike={toggleLike}
                  onTagClick={selectTag}
                  onOpenProfile={onOpenProfile}
                  onOpenPost={onOpenPost}
                  onRequireAuth={onRequireAuth}
                  showMessage={showMessage}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="right-rail">
          <section className="side-card tag-card">
            <span className="section-label">热门标签</span>
            <h2>正在讨论的话题</h2>
            {tags.length === 0 ? (
              <p className="side-note">发布带标签的帖子后，这里会自动生成话题。</p>
            ) : (
              <div className="tag-cloud">
                {tags.map((tag) => (
                  <button
                    className={`tag-chip${filterTag === tag.name ? " active" : ""}`}
                    type="button"
                    key={tag.name}
                    onClick={() => selectTag(tag.name)}
                  >
                    #{tag.name}
                    <span>{tag.post_count}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="side-card status-card">
            <span className="section-label">新能力</span>
            <h2>现在可以这样用</h2>
            <div className="status-list">
              <div>
                <span className="status-dot" />
                <p>
                  <strong>全文搜索</strong>
                  <small>查找帖子、作者和标签</small>
                </p>
              </div>
              <div>
                <span className="status-dot" />
                <p>
                  <strong>帖子详情</strong>
                  <small>查看完整内容与评论</small>
                </p>
              </div>
              <div>
                <span className="status-dot" />
                <p>
                  <strong>个人主页</strong>
                  <small>查看简介和公开帖子</small>
                </p>
              </div>
            </div>
          </section>

          <section className="side-card roadmap-card">
            <span className="section-label">下一站</span>
            <h2>继续扩展内容</h2>
            <ol className="roadmap-list">
              <li>
                <span>01</span>
                图片上传与封面
              </li>
              <li>
                <span>02</span>
                通知与关注
              </li>
              <li>
                <span>03</span>
                管理后台与数据统计
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}

