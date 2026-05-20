# TwoLife Memory

A beautiful, intimate digital space for couples to save their memories together.

## Features
- **Dashboard**: A warm summary of time together, latest photos, and stories.
- **Timeline**: Chronological memory tracking with cover images and mood.
- **Photos**: Upload and view full-res images in a waterfall gallery.
- **Blog**: Write down travel diaries, reflections, or everyday stories.
- **Anniversaries**: Track important dates with live day counters.
- **Theme Support**: Customizable themes (Romantic Pink, Ocean Blue, Lavender Purple, Fresh Green, Warm Beige).

## Tech Stack
- Frontend: React 19, Vite, Tailwind CSS v4, shadcn/ui, React Router, TanStack Query
- Backend: Express.js, SQLite (via `better-sqlite3`), bcryptjs, JWT
- Platform: Built natively for Google AI Studio

## Local Development
1. Clone the repository.
2. Run `npm install`.
3. Set your JWT_SECRET in `.env` (copy from `.env.example`).
4. Run `npm run dev`.

The app will start on port 3000.

## Default Account
- **Username / Email**: `admin` or `admin@example.com`
- **Password**: `123456`

## 一键部署（Nginx + HTTPS）

> 适用于 Ubuntu 22.04/24.04，需提前把域名 A 记录解析到服务器公网 IP。

1. 进入项目目录并给脚本执行权限（仓库已默认设置）：
   ```bash
   chmod +x deploy/deploy_https_nginx.sh
   ```
2. 使用 root 执行：
   ```bash
   sudo bash deploy/deploy_https_nginx.sh -d your.domain.com -e admin@example.com
   ```

脚本会自动完成：
- 安装 Node.js、Nginx、Certbot
- 安装依赖并构建前后端
- 创建 `systemd` 服务 `twolife`
- 配置 Nginx 反向代理
- 自动申请 Let's Encrypt 证书并开启 HTTPS 强制跳转
