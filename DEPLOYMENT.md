# 免费云部署说明

部署方案：

- GitHub：保存代码并自动触发部署。
- Render：免费运行 React + FastAPI 网站。
- Neon：免费提供 PostgreSQL 数据库。
- 网址：Render 会提供一个免费的 `onrender.com` 子域名。

## 1. 创建 Neon 数据库

1. 打开 <https://neon.com>。
2. 使用 GitHub 登录。
3. 创建一个免费项目。
4. 复制 PostgreSQL 连接地址，格式类似：

```text
postgresql://user:password@host/database?sslmode=require
```

## 2. 创建 Render 网站

1. 打开 <https://render.com>。
2. 使用 GitHub 登录。
3. 选择 `New`、`Blueprint`。
4. 连接仓库：

```text
chlin112714-commits/weiguang-community
```

5. Render 会读取根目录的 `render.yaml`。
6. 在 `DATABASE_URL` 环境变量中粘贴 Neon 连接地址。
7. 确认创建免费 Web Service。

## 3. 等待部署

Render 会：

1. 使用 Node.js 构建 React 前端。
2. 使用 Python 安装 FastAPI 和 PostgreSQL 驱动。
3. 把 React 生产页面交给 FastAPI 同域提供。
4. 启动 `uvicorn`。
5. 提供一个类似下面的公开网址：

```text
https://weiguang-community.onrender.com
```

## 4. 迁移本地数据

在项目根目录设置数据库地址后运行：

```powershell
$env:DATABASE_URL = "你的 PostgreSQL 连接地址"
backend\.venv\Scripts\python.exe backend\scripts\migrate_sqlite_to_postgres.py
```

如果远程数据库已经有数据，先确认是否要执行覆盖：

```powershell
backend\.venv\Scripts\python.exe backend\scripts\migrate_sqlite_to_postgres.py --replace
```

## 5. 后续更新

代码推送到 GitHub 的 `main` 分支后，Render 会自动重新部署。

```powershell
git add .
git commit -m "Update website"
git push
```

注意：Render 免费服务在一段时间没有访问后会休眠，再次打开时可能需要几十秒唤醒。Neon 免费数据库适合测试和小规模使用。
