# 项目进度

更新时间：2026-09-30

## 当前版本

`0.3.0`：内容、搜索和个人主页阶段

## 已完成

- 账号注册、登录、退出和 HttpOnly Cookie 登录状态。
- 第一个注册账号自动成为管理员。
- 帖子发布、编辑、删除和标签编辑。
- 评论发布、编辑和删除。
- 点赞与取消点赞。
- 帖子详情页。
- 个人主页、个人简介和公开发帖记录。
- 全文搜索，可以匹配帖子、作者和标签。
- 热门标签列表和标签筛选。
- 原有匿名留言迁移为历史帖子。
- 前端组件化拆分，后续继续加功能更方便。
- 首页、详情页和个人主页已经做真实浏览器检查。
- 当前公网地址已经切换到新版：
  `https://rear-guild-appearing-belts.trycloudflare.com`

## 当前访问方式

- 后端监听：`http://127.0.0.1:8000`
- 临时公网地址依赖本机、后端和 `cloudflared` 持续运行。
- 电脑休眠、关机、断网或隧道退出后，地址会失效。

## 下一阶段

1. 图片上传、头像和帖子封面。
2. 通知中心与关注关系。
3. 管理后台、举报和内容审核。
4. PostgreSQL、Docker、固定域名和 HTTPS 正式部署。

## 当前保存点

更新时间：2026-09-30 09:20

- 当前代码工作区干净，已经推送到 GitHub。
- GitHub 仓库：
  `https://github.com/chlin112714-commits/weiguang-community`
- 最新提交：`30fd66e Add free cloud deployment guide`
- 本地 SQLite 数据库正常运行，共有 4 条历史帖子和最新结构。
- 数据库备份：
  - `backend/data/app-before-community-20260930-084958.db`
  - `backend/data/app-before-phase2-20260930-090034.db`
- 免费云部署配置已经完成：
  - `Dockerfile`
  - `render.yaml`
  - `DEPLOYMENT.md`
  - PostgreSQL 驱动和兼容层
- Render 和 Neon 还没有完成登录和创建服务。
- 当前临时公网地址仍在运行：
  `https://rear-guild-appearing-belts.trycloudflare.com`
- 临时地址依赖本机、FastAPI 和 cloudflared 持续运行。

## 下次继续

1. 使用 Google 登录 Render，或在外部浏览器登录 GitHub。
2. 在 Neon 创建免费 PostgreSQL 数据库。
3. 在 Render 使用公开 Git 仓库地址部署。
4. 配置 `DATABASE_URL`。
5. 迁移现有 SQLite 数据。
6. 测试正式 Render 网址。

## 晚上继续

更新时间：2026-09-30 09:30

- GitHub 网络已经恢复测试。
- Render 注册过程中暂时卡住，用户计划晚上继续。
- 当前临时公网网站仍然正常：
  `https://rear-guild-appearing-belts.trycloudflare.com`
- 当前数据库运行正常，最新备份为：
  `backend/data/app-checkpoint-20260930-0920.db`
- 下次从 Render 注册开始，优先使用 Google 或邮箱注册。
- GitHub 已经可以直接使用，代码和部署配置都已经推送。

## 最新保存点

更新时间：2026-09-30 晚

- Vercel 免费账号已经注册并登录。
- Vercel 团队：`weiguang-community`
- Vercel 项目已经成功部署到生产环境：
  `https://weiguang-community.vercel.app`
- 部署保护已经关闭，Vercel 侧允许公开访问。
- 当前网络把 `vercel.app` 解析到了错误 IP，所以国内手机暂时打不开该地址，这不是部署失败。
- 当前可用的临时公网地址：
  `https://colon-test-virgin-grams.trycloudflare.com`
- 临时地址依赖本机、FastAPI 和 cloudflared 持续运行。
- Render 免费方案要求银行卡验证，因此没有采用。
- 已经新增 Vercel 部署配置：
  - `api/index.py`
  - `vercel.json`
  - `requirements.txt`
  - `.vercelignore`

## 永久访问下一步

1. 准备腾讯云或阿里云账号。
2. 购买一台长期在线服务器；香港节点不需要 ICP，国内节点通常需要备案。
3. 购买并绑定域名。
4. 使用 Docker 部署当前项目。
5. 迁移 SQLite 数据，并开启 HTTPS 和自动更新。
