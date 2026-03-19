#!/bin/bash
set -e

echo "🚀 Starting Screaming Toller Bootstrap..."

# 1. Update and install basics
apt-get update
apt-get upgrade -y
apt-get install -y curl git unzip build-essential software-properties-common

# 2. Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# 3. Install Nginx & Certbot
echo "🌐 Installing Nginx & Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# 4. Configure Firewall
echo "🛡️ Configuring Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# 5. Setup Project Directory
mkdir -p /app
cd /app

echo "✅ Bootstrap complete!"
echo "Next steps:"
echo "1. Clone your repo into /app"
echo "2. Copy deploy/nginx/nginx.conf to /etc/nginx/sites-available/toller"
echo "3. Link it: ln -s /etc/nginx/sites-available/toller /etc/nginx/sites-enabled/"
echo "4. Create .env file"
echo "5. Run: docker compose up -d --build"
echo "6. Run: certbot --nginx"
