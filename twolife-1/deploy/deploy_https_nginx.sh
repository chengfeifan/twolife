#!/usr/bin/env bash
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "请使用 root 运行：sudo bash deploy/deploy_https_nginx.sh -d your.domain.com"
  exit 1
fi

DOMAIN=""
EMAIL=""
APP_PORT="3000"
APP_DIR="/opt/twolife"
NODE_ENV="production"

usage() {
  cat <<USAGE
用法：bash deploy/deploy_https_nginx.sh -d <domain> [-e email] [-p app_port] [-a app_dir]
示例：bash deploy/deploy_https_nginx.sh -d memory.example.com -e admin@example.com
USAGE
}

while getopts ":d:e:p:a:h" opt; do
  case ${opt} in
    d) DOMAIN="$OPTARG" ;;
    e) EMAIL="$OPTARG" ;;
    p) APP_PORT="$OPTARG" ;;
    a) APP_DIR="$OPTARG" ;;
    h)
      usage
      exit 0
      ;;
    \?)
      echo "未知参数: -$OPTARG"
      usage
      exit 1
      ;;
    :)
      echo "参数 -$OPTARG 需要值"
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$DOMAIN" ]]; then
  echo "必须指定域名 -d"
  usage
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  EMAIL="admin@${DOMAIN}"
fi

echo "==> 安装依赖..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends curl nginx certbot python3-certbot-nginx build-essential

if ! command -v node >/dev/null 2>&1; then
  echo "==> 安装 Node.js 20.x ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

mkdir -p "$APP_DIR"
if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "==> 首次部署：复制当前项目到 $APP_DIR"
  SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
  rsync -a --delete --exclude node_modules --exclude dist "$SRC_DIR/" "$APP_DIR/"
fi

cd "$APP_DIR"

echo "==> 安装并构建项目..."
npm install
npm run build

if [[ ! -f .env ]]; then
  echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
  echo "已创建 .env"
fi

echo "==> 配置 systemd 服务..."
cat > /etc/systemd/system/twolife.service <<SERVICE
[Unit]
Description=TwoLife App
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=$NODE_ENV
Environment=PORT=$APP_PORT
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/dist/server.cjs
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable twolife.service
systemctl restart twolife.service

echo "==> 配置 Nginx..."
cat > /etc/nginx/sites-available/twolife <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/twolife /etc/nginx/sites-enabled/twolife
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "==> 申请 HTTPS 证书..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect

echo "部署完成: https://$DOMAIN"
echo "应用目录: $APP_DIR"
echo "服务状态: systemctl status twolife"
