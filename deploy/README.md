# Screaming Toller — DigitalOcean Deployment Guide

This guide covers deploying the full stack to a single DigitalOcean Droplet with automated CD via GitHub Actions.

## 1. Droplet Setup

1. Create a Droplet (Ubuntu 22.04 LTS, at least 1GB RAM recommended).
2. Point your domain A record to the Droplet's IP address.
3. SSH into your Droplet as root.
4. Run the bootstrap script:
   ```bash
   # Assuming you've cloned the repo or copied the file
   chmod +x deploy/bootstrap.sh
   ./deploy/bootstrap.sh
   ```

## 2. Nginx & SSL

1. Copy the nginx config:
   ```bash
   cp deploy/nginx/nginx.conf /etc/nginx/sites-available/toller
   # Edit /etc/nginx/sites-available/toller and replace 'server_name' with your domain
   ln -s /etc/nginx/sites-available/toller /etc/nginx/sites-enabled/
   rm /etc/nginx/sites-enabled/default
   nginx -t && systemctl reload nginx
   ```
2. Run Certbot for HTTPS:
   ```bash
   certbot --nginx -d yourdomain.com
   ```

## 3. GitHub Actions CI/CD Secrets

Add these secrets to your GitHub repository (**Settings > Secrets and variables > Actions**):

- `DROPLET_IP`: The IP address of your Droplet.
- `SSH_PRIVATE_KEY`: A private key for access (public key must be in Droplet's `/root/.ssh/authorized_keys`).
- `SSH_USER`: `root`.

## 4. First Deployment

1. On the Droplet, create the production `.env` file in `/app`:
   ```bash
   cp deploy/.env.production.example .env
   # Edit .env with your real production secrets
   ```
2. Push your code to the `main` branch. GitHub Actions will handle the build and deploy.

## 5. Super Admin Promotion

Once you have registered your account, promote yourself to Super Admin via SQL:

```bash
docker exec -it toller_db psql -U toller_prod_user -d screaming_toller_prod
```

Then run:

```sql
UPDATE users SET is_super_admin = true WHERE email = 'your-email@example.com';
```
