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

# Add current user to docker group if not already there
if ! groups $USER | grep &>/dev/null "\bdocker\b"; then
    echo "👥 Adding $USER to the docker group..."
    usermod -aG docker $USER
    echo "⚠️  IMPORTANT: You must log out and log back in (or start a new SSH session) for group changes to take effect."
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
echo "1. IMPORTANT: Log out and back in to your SSH session to enable Docker permissions."
echo "2. Clone your repository into /app:"
echo "   git clone <your-repo-url> /app"
echo "3. Copy deploy/nginx/nginx.conf to /etc/nginx/sites-available/toller"
echo "4. Link it: ln -s /etc/nginx/sites-available/toller /etc/nginx/sites-enabled/"
echo "5. Create .env file in /app"
echo "6. Run: cd /app && docker compose up -d --build"
echo "7. Run: certbot --nginx"
