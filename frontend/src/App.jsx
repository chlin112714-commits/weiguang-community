import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "./api";
import HomePage from "./components/HomePage";
import PostDetailPage from "./components/PostDetailPage";
import ProfilePage from "./components/ProfilePage";
import { getRoute, postPath, profilePath } from "./utils";

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [route, setRoute] = useState(getRoute);
  const [filterTag, setFilterTag] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    username: "",
    display_name: "",
    password: "",
  });
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const showMessage = useCallback((text, tone = "success") => {
    setNotice({ text, tone });
  }, []);

  useEffect(() => {
    const handleRouteChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", handleRouteChange);
    return () => window.removeEventListener("hashchange", handleRouteChange);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const user = await apiRequest("/api/auth/me");
        if (active) {
          setCurrentUser(user);
        }
      } catch (error) {
        if (active) {
          showMessage(error.message, "error");
        }
      }
    }

    loadUser();
    return () => {
      active = false;
    };
  }, [showMessage]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [route.name, route.postId, route.username]);

  function navigate(hash) {
    if (window.location.hash === hash) {
      setRoute(getRoute());
      return;
    }
    window.location.hash = hash;
  }

  function goHome(anchor = null) {
    navigate("#/");
    if (anchor) {
      window.setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    }
  }

  function openPost(postId) {
    navigate(postPath(postId));
  }

  function openProfile(username) {
    if (!username) {
      return;
    }
    navigate(profilePath(username));
  }

  function openTag(tag) {
    setFilterTag(tag);
    goHome("feed");
  }

  function requireAuth() {
    showMessage("请先登录或注册后再继续", "info");
    goHome("join");
  }

  function updateAuthField(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setAuthBusy(true);
    try {
      const endpoint =
        authMode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        authMode === "register"
          ? authForm
          : { username: authForm.username, password: authForm.password };
      const user = await apiRequest(endpoint, {
        method: "POST",
        body: payload,
      });
      setCurrentUser(user);
      setAuthForm({ username: "", display_name: "", password: "" });
      showMessage(
        authMode === "register"
          ? user.role === "admin"
            ? "注册成功。你是社区首位管理员。"
            : "注册成功，欢迎加入社区。"
          : `欢迎回来，${user.display_name}`,
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    setAuthBusy(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      setFilterTag("");
      goHome();
      showMessage("已安全退出登录");
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="topbar">
          <button className="brand brand-button" type="button" onClick={() => goHome()}>
            <span className="brand-mark">微</span>
            <span>
              <strong>微光社区</strong>
              <small>把想法留在这里</small>
            </span>
          </button>

          <nav className="main-nav" aria-label="主导航">
            <button type="button" onClick={() => goHome("feed")}>
              社区动态
            </button>
            <button type="button" onClick={() => goHome("about")}>
              关于社区
            </button>
            {currentUser ? (
              <button
                type="button"
                onClick={() => openProfile(currentUser.username)}
              >
                个人主页
              </button>
            ) : (
              <button type="button" onClick={() => goHome("join")}>
                加入我们
              </button>
            )}
          </nav>

          <div className="header-account">
            {currentUser ? (
              <>
                <button
                  className="header-user header-user-button"
                  type="button"
                  onClick={() => openProfile(currentUser.username)}
                >
                  <span className="mini-dot" />
                  {currentUser.display_name}
                </button>
                <button
                  className="button button-ghost button-small"
                  type="button"
                  onClick={logout}
                  disabled={authBusy}
                >
                  退出
                </button>
              </>
            ) : (
              <button
                className="button button-dark button-small"
                type="button"
                onClick={() => goHome("join")}
              >
                登录 / 注册
              </button>
            )}
          </div>
        </div>
      </header>

      <main id="top">
        {route.name === "home" && (
          <HomePage
            key={`home-${currentUser?.id ?? "guest"}`}
            currentUser={currentUser}
            authMode={authMode}
            setAuthMode={setAuthMode}
            authForm={authForm}
            onAuthFieldChange={updateAuthField}
            onSubmitAuth={submitAuth}
            onLogout={logout}
            authBusy={authBusy}
            onOpenProfile={openProfile}
            onOpenPost={openPost}
            onRequireAuth={requireAuth}
            showMessage={showMessage}
            filterTag={filterTag}
            onFilterTagChange={setFilterTag}
          />
        )}

        {route.name === "post" && (
          <PostDetailPage
            key={`post-${route.postId}-${currentUser?.id ?? "guest"}`}
            postId={route.postId}
            currentUser={currentUser}
            onBack={() => goHome("feed")}
            onOpenProfile={openProfile}
            onTagClick={openTag}
            onRequireAuth={requireAuth}
            showMessage={showMessage}
          />
        )}

        {route.name === "profile" && (
          <ProfilePage
            key={`profile-${route.username}-${currentUser?.id ?? "guest"}`}
            username={route.username}
            currentUser={currentUser}
            onBack={() => goHome("feed")}
            onOpenPost={openPost}
            onOpenProfile={openProfile}
            onTagClick={openTag}
            onRequireAuth={requireAuth}
            onCurrentUserUpdated={setCurrentUser}
            showMessage={showMessage}
          />
        )}
      </main>

      {notice && (
        <div className={`notice ${notice.tone}`} role="status">
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="关闭提示"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
