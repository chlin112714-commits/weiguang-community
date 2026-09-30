import Avatar from "./Avatar";

export default function AuthPanel({
  currentUser,
  authMode,
  setAuthMode,
  authForm,
  onAuthFieldChange,
  onSubmit,
  onLogout,
  onOpenProfile,
  busy,
}) {
  return (
    <section className="side-card join-card" id="join">
      {currentUser ? (
        <>
          <div className="profile-row">
            <Avatar
              author={currentUser}
              onClick={() => onOpenProfile(currentUser.username)}
            />
            <div>
              <span className="section-label">当前账号</span>
              <h2>{currentUser.display_name}</h2>
              <p>@{currentUser.username}</p>
            </div>
          </div>
          <div className="profile-meta">
            <span>{currentUser.role === "admin" ? "管理员" : "社区成员"}</span>
            <span>已登录</span>
          </div>
          <p className="side-note">
            {currentUser.bio || "完善个人简介后，别人可以更好地认识你。"}
          </p>
          <div className="panel-actions">
            <button
              className="button button-light button-small"
              type="button"
              onClick={() => onOpenProfile(currentUser.username)}
            >
              个人主页
            </button>
            <button
              className="button button-ghost button-small"
              type="button"
              onClick={onLogout}
              disabled={busy}
            >
              退出
            </button>
          </div>
        </>
      ) : (
        <>
          <span className="section-label">加入社区</span>
          <h2>留下你的名字</h2>
          <p className="side-note">
            注册后即可发帖、点赞和评论。第一个注册账号会成为管理员。
          </p>
          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("login")}
            >
              登录
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              type="button"
              onClick={() => setAuthMode("register")}
            >
              注册
            </button>
          </div>
          <form className="auth-form" onSubmit={onSubmit}>
            {authMode === "register" && (
              <label>
                显示昵称
                <input
                  name="display_name"
                  value={authForm.display_name}
                  onChange={onAuthFieldChange}
                  maxLength={30}
                  placeholder="例如：小林"
                  autoComplete="nickname"
                  required
                />
              </label>
            )}
            <label>
              用户名
              <input
                name="username"
                value={authForm.username}
                onChange={onAuthFieldChange}
                minLength={3}
                maxLength={24}
                pattern="[A-Za-z0-9_]+"
                placeholder="字母、数字或下划线"
                autoComplete="username"
                required
              />
            </label>
            <label>
              密码
              <input
                type="password"
                name="password"
                value={authForm.password}
                onChange={onAuthFieldChange}
                minLength={6}
                maxLength={128}
                placeholder="至少 6 位"
                autoComplete={
                  authMode === "register" ? "new-password" : "current-password"
                }
                required
              />
            </label>
            <button
              className="button button-dark button-full"
              type="submit"
              disabled={busy}
            >
              {busy
                ? "正在处理..."
                : authMode === "register"
                  ? "注册并进入社区"
                  : "登录"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
