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
BACKUP_DIR="/var/backups/twolife"
BACKUP_RETENTION_DAYS="14"

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
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$APP_DIR/package.json" ]]; then
  echo "==> 首次部署：复制当前项目到 $APP_DIR"
else
  echo "==> 增量部署：同步最新代码到 $APP_DIR"
fi
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude uploads \
  --exclude database.sqlite \
  --exclude database.sqlite-shm \
  --exclude database.sqlite-wal \
  --exclude .env \
  "$SRC_DIR/" "$APP_DIR/"

cd "$APP_DIR"
mkdir -p "$APP_DIR/uploads"
chmod 775 "$APP_DIR/uploads"

if [[ -f "$APP_DIR/database.sqlite" ]]; then
  echo "==> 检测到现有数据库，已保留历史数据"
fi

echo "==> 安装并构建项目..."
npm install
npm run build

if [[ ! -f .env ]]; then
  echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
  echo "已创建 .env"
fi

echo "==> 配置自动备份..."
mkdir -p "$BACKUP_DIR"

cat > /usr/local/bin/twolife_backup.sh <<BACKUP
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$APP_DIR"
BACKUP_DIR="$BACKUP_DIR"
RETENTION_DAYS="$BACKUP_RETENTION_DAYS"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="$BACKUP_DIR/twolife_backup_${TIMESTAMP}.tar.gz"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$BACKUP_DIR"

if [[ -f "$APP_DIR/database.sqlite" ]]; then
  cp "$APP_DIR/database.sqlite" "$TMP_DIR/database.sqlite"
fi
if [[ -f "$APP_DIR/database.sqlite-shm" ]]; then
  cp "$APP_DIR/database.sqlite-shm" "$TMP_DIR/database.sqlite-shm"
fi
if [[ -f "$APP_DIR/database.sqlite-wal" ]]; then
  cp "$APP_DIR/database.sqlite-wal" "$TMP_DIR/database.sqlite-wal"
fi
if [[ -f "$APP_DIR/.env" ]]; then
  cp "$APP_DIR/.env" "$TMP_DIR/.env"
fi
if [[ -d "$APP_DIR/uploads" ]]; then
  cp -a "$APP_DIR/uploads" "$TMP_DIR/uploads"
fi

tar -czf "$ARCHIVE_PATH" -C "$TMP_DIR" .
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'twolife_backup_*.tar.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup created: $ARCHIVE_PATH"
BACKUP

chmod +x /usr/local/bin/twolife_backup.sh

cat > /etc/systemd/system/twolife-backup.service <<SERVICE
[Unit]
Description=TwoLife Backup Service
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/twolife_backup.sh
User=root
SERVICE

cat > /etc/systemd/system/twolife-backup.timer <<TIMER
[Unit]
Description=Run TwoLife backup daily

[Timer]
OnCalendar=daily
Persistent=true
Unit=twolife-backup.service

[Install]
WantedBy=timers.target
TIMER

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
Environment=MAX_UPLOAD_MB=20
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
systemctl enable --now twolife-backup.timer

echo "==> 配置 Nginx..."
cat > /etc/nginx/sites-available/twolife <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 20M;

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

    location /api/upload {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_read_timeout 120s;
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
echo "备份定时器: systemctl status twolife-backup.timer"
echo "手动备份: /usr/local/bin/twolife_backup.sh"
