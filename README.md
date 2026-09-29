# 我的第一个全栈网站

这是一个最小但完整的网站项目，用来跑通：

```text
浏览器
  ↓
React 前端
  ↓
FastAPI 后端
  ↓
SQLite 数据库
  ↓
返回数据并显示
```

## 1. 启动后端

在项目根目录打开 PowerShell：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

后端接口文档：<http://127.0.0.1:8000/docs>

## 2. 启动前端

再打开一个 PowerShell：

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开：<http://127.0.0.1:5173>

## 3. 数据流向

1. 在 React 页面填写名字和留言。
2. 前端通过 `/api/messages` 请求 FastAPI。
3. FastAPI 将留言写入 `backend/data/app.db`。
4. 数据库返回新记录，页面立即显示。

## 下一步

- 给页面增加修改和删除留言功能。
- 加入登录和用户数据隔离。
- 部署前端和后端，获得真正的公开网址。
