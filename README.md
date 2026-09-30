# 微光社区

一个可以继续扩展的个人留言社区，已经包含账号、内容、互动、搜索、标签和个人主页。

## 当前功能

- 注册、登录、退出和登录状态保持
- 第一个注册账号自动成为管理员
- 发布、编辑和删除帖子
- 点赞和取消点赞
- 评论、编辑评论和删除评论
- 热门标签与标签筛选
- 按帖子内容、作者或标签搜索
- 独立帖子详情页
- 个人主页、个人简介和公开帖子
- 原有匿名留言自动迁移为历史帖子
- 手机和电脑自适应布局
- 前端生产版本可合并为单个 HTML 页面

## 启动后端

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

接口文档：<http://127.0.0.1:8000/docs>

## 开发前端

```powershell
cd frontend
npm run dev
```

浏览器打开：<http://127.0.0.1:5173>

## 构建正式前端

```powershell
cd frontend
npm run build
```

构建结果在 `frontend/dist/index.html`，FastAPI 会自动提供这个页面。

## 临时公网访问

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --no-autoupdate
```

Cloudflare 会输出一个随机的 `trycloudflare.com` 地址。临时地址依赖本机、后端和隧道程序持续运行，只适合测试。

## 数据说明

- 默认数据库：`backend/data/app.db`
- 启动时自动创建表和索引
- 原 `messages` 表保留，第一次升级时复制到 `posts`
- 升级前会在 `backend/data` 留下数据库备份
- 正式部署时建议改用 PostgreSQL，并配置持久化存储和定期备份

## 后续计划

1. 图片上传、头像和帖子封面
2. 通知中心与关注关系
3. 管理后台、举报和内容审核
4. Docker、固定域名、HTTPS 和自动部署
