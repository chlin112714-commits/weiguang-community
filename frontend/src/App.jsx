import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function formatTime(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ name: "", content: "" });
  const [status, setStatus] = useState("正在连接后端...");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(`${API_BASE}/api/messages`);
        if (!response.ok) {
          throw new Error("暂时无法读取留言");
        }
        const data = await response.json();
        setMessages(data);
        setStatus("前后端与数据库连接正常");
      } catch (loadError) {
        setStatus("后端尚未启动");
        setError(loadError.message);
      }
    }

    loadMessages();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitMessage(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const problem = await response.json();
        const detail = Array.isArray(problem.detail)
          ? problem.detail[0]?.msg
          : problem.detail;
        throw new Error(detail || "留言发送失败");
      }

      const newMessage = await response.json();
      setMessages((current) => [newMessage, ...current]);
      setForm({ name: "", content: "" });
      setStatus("数据已写入 SQLite，并成功返回页面");
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="eyebrow">
          <span className="status-dot" />
          React + FastAPI + SQLite
        </div>
        <h1>我的第一个全栈网站</h1>
        <p>
          输入一条留言，它会经过 React 页面、Python 后端和数据库，再回到这里。
        </p>
        <div className="flow" aria-label="技术流程">
          <span>浏览器</span>
          <b>→</b>
          <span>React</span>
          <b>→</b>
          <span>FastAPI</span>
          <b>→</b>
          <span>SQLite</span>
        </div>
      </section>

      <section className="workspace">
        <form className="message-form" onSubmit={submitMessage}>
          <div>
            <p className="section-label">发布留言</p>
            <h2>让整条链路动起来</h2>
          </div>

          <label>
            你的名字
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              maxLength={40}
              placeholder="例如：小林"
              required
            />
          </label>

          <label>
            留言内容
            <textarea
              name="content"
              value={form.content}
              onChange={updateField}
              maxLength={500}
              rows={5}
              placeholder="写下你想说的内容..."
              required
            />
          </label>

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "正在保存..." : "保存到数据库"}
          </button>

          <p className="system-status" aria-live="polite">
            <span className="status-dot" />
            {status}
          </p>
          {error && <p className="error-message">{error}</p>}
        </form>

        <section className="message-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">数据库记录</p>
              <h2>最新留言</h2>
            </div>
            <span className="message-count">{messages.length} 条</span>
          </div>

          {messages.length === 0 ? (
            <div className="empty-state">
              <strong>这里还是空的</strong>
              <p>发布第一条留言后，它会从 SQLite 返回并显示在这里。</p>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => (
                <article className="message-card" key={message.id}>
                  <header>
                    <strong>{message.name}</strong>
                    <time dateTime={message.created_at}>
                      {formatTime(message.created_at)}
                    </time>
                  </header>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
