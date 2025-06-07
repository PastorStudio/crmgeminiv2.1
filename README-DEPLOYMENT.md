# WhatsApp CRM System - VPS Deployment Guide

## 🚀 Easy VPS Deployment for Contabo/DigitalOcean/AWS

### Method 1: One-Command Installation

**For AAPanel or direct SSH access:**

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_USERNAME/whatsapp-crm-system/main/quick-install.sh | bash
```

### Method 2: Manual Installation Steps

#### Step 1: Prepare Your VPS
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential
```

#### Step 2: Clone Repository
```bash
cd /home/$USER
git clone https://github.com/YOUR_USERNAME/whatsapp-crm-system.git
cd whatsapp-crm-system
```

#### Step 3: Run Auto-Deploy Script
```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

#### Step 4: Configure Environment
```bash
nano .env
```

Add your API keys:
```env
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://whatsapp_user:password@localhost:5432/whatsapp_crm_db
PORT=3000
NODE_ENV=production
```

#### Step 5: Start Application
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Method 3: AAPanel Integration

1. **Install AAPanel:**
```bash
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh
sudo bash install.sh aapanel
```

2. **Create Site in AAPanel:**
   - Go to Website → Add Site
   - Domain: your-domain.com or server IP
   - PHP Version: None (Node.js app)
   - Root Directory: /www/wwwroot/whatsapp-crm

3. **Upload and Deploy:**
   - Use AAPanel File Manager to upload project files
   - Run deployment script through AAPanel Terminal

### Method 4: Bitvise SFTP Upload

1. **Connect via Bitvise:**
   - Host: Your VPS IP
   - Username: root or your user
   - Authentication: Password/SSH Key

2. **Upload Files:**
   - Upload entire project folder to `/home/username/whatsapp-crm`
   - Set permissions: `chmod -R 755 whatsapp-crm`

3. **Deploy:**
```bash
cd whatsapp-crm
./deploy-vps.sh
```

## 🔧 Production Configuration

### Nginx Configuration (Automatic)
The deployment script automatically configures Nginx:
- HTTP on port 80
- WebSocket support for /ws
- Proxy to Node.js app on port 3000

### PM2 Process Management
```bash
# View status
pm2 status

# View logs
pm2 logs whatsapp-crm

# Restart app
pm2 restart whatsapp-crm

# Stop app
pm2 stop whatsapp-crm

# Monitor
pm2 monit
```

### Database Setup
PostgreSQL is automatically configured with:
- Database: `whatsapp_crm_db`
- User: `whatsapp_user`
- Password: Auto-generated (shown during installation)

## 🛡️ Security & Firewall

The deployment script automatically:
- Configures UFW firewall
- Opens required ports (22, 80, 443, 3000)
- Sets up secure database access

## 📊 Monitoring & Maintenance

### Health Checks
```bash
# Check application status
curl http://localhost:3000/api/health

# Check database connection
sudo -u postgres psql -c "SELECT 1"

# Check Nginx status
sudo systemctl status nginx
```

### Log Files
- Application: `pm2 logs`
- Nginx: `/var/log/nginx/`
- PostgreSQL: `/var/log/postgresql/`

### Updates
```bash
cd whatsapp-crm
git pull origin main
npm install
npm run build
pm2 restart whatsapp-crm
```

## 🔑 Required API Keys

### OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Create new API key
3. Add to `.env` file: `OPENAI_API_KEY=sk-...`

### Environment Variables
```env
# Required
OPENAI_API_KEY=your_openai_key
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Optional
PORT=3000
NODE_ENV=production
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

## 🚨 Troubleshooting

### Common Issues

**Port 3000 already in use:**
```bash
sudo netstat -tulpn | grep :3000
sudo kill -9 PID_NUMBER
```

**Database connection failed:**
```bash
sudo systemctl restart postgresql
sudo -u postgres psql -c "ALTER USER whatsapp_user PASSWORD 'newpassword';"
```

**Nginx configuration errors:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

**Permission denied:**
```bash
sudo chown -R $USER:$USER /path/to/whatsapp-crm
chmod +x deploy-vps.sh
```

## 📱 Access Your Application

After successful deployment:
- **Main Application:** `http://your-server-ip` (if Nginx installed)
- **Direct Access:** `http://your-server-ip:3000`
- **Admin Panel:** `http://your-server-ip:3000/admin`

## 🔄 Automatic Deployment

### GitHub Actions (Optional)
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to VPS
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.4
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd whatsapp-crm
            git pull origin main
            npm install
            npm run build
            pm2 restart whatsapp-crm
```

## 📞 Support

For deployment issues:
1. Check logs: `pm2 logs whatsapp-crm`
2. Verify environment: `cat .env`
3. Test database: `npm run db:push`
4. Restart services: `pm2 restart all && sudo systemctl restart nginx`

## 🎯 Performance Optimization

### Production Settings
- Node.js cluster mode via PM2
- Nginx reverse proxy with compression
- PostgreSQL connection pooling
- Static file caching

### Monitoring
```bash
# Server resources
htop

# Application metrics
pm2 monit

# Database performance
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

This guide provides multiple deployment options suitable for different VPS providers and technical skill levels.