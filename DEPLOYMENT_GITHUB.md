# GitHub Deployment Guide - WhatsApp CRM System

## Quick VPS Deployment for Contabo

### Method 1: AAPanel Deployment (Recommended)

1. **Install AAPanel on your Contabo VPS:**
```bash
wget -O install.sh http://www.aapanel.com/script/install-ubuntu_6.0_en.sh && sudo bash install.sh aapanel
```

2. **Clone Repository:**
```bash
cd /www/wwwroot
git clone https://github.com/YOUR_USERNAME/whatsapp-crm-system.git
cd whatsapp-crm-system
```

3. **Install Dependencies:**
```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Install system dependencies
sudo apt-get install -y build-essential python3-pip
```

4. **Setup Database:**
```bash
sudo -u postgres createuser --interactive --pwprompt whatsapp_user
sudo -u postgres createdb whatsapp_crm_db -O whatsapp_user
```

5. **Configure Environment:**
```bash
cp .env.example .env
# Edit .env with your database credentials and API keys
nano .env
```

6. **Install and Build:**
```bash
npm install
npm run build
npm run db:push
```

7. **Start with PM2:**
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Method 2: Bitvise Direct Deployment

1. **Upload via Bitvise SFTP:**
   - Connect to your Contabo VPS
   - Upload the entire project folder to `/home/YOUR_USER/whatsapp-crm`

2. **Run Auto-Install Script:**
```bash
cd /home/YOUR_USER/whatsapp-crm
chmod +x deploy-vps.sh
./deploy-vps.sh
```

### Required Environment Variables (.env)

```env
# Database
DATABASE_URL="postgresql://whatsapp_user:your_password@localhost:5432/whatsapp_crm_db"

# OpenAI
OPENAI_API_KEY="your_openai_key"

# Server
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET="your_jwt_secret_here"
SESSION_SECRET="your_session_secret_here"
```

### GitHub Repository Structure

Your repository should contain:
- Complete source code
- `ecosystem.config.js` for PM2
- `deploy-vps.sh` auto-install script
- `nginx.conf` configuration
- `package.json` with all dependencies
- Database migration files

### Troubleshooting Common Issues

1. **Permission Errors:**
```bash
sudo chown -R $USER:$USER /path/to/project
chmod +x deploy-vps.sh
```

2. **Database Connection:**
```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

3. **Port Conflicts:**
```bash
sudo netstat -tulpn | grep :3000
sudo kill -9 PID_NUMBER
```

### Access Your Application

After successful deployment:
- Web Interface: `http://your-server-ip:3000`
- Admin Panel: `http://your-server-ip:3000/admin`

### Maintenance Commands

```bash
# View logs
pm2 logs

# Restart application
pm2 restart all

# Update from GitHub
git pull origin main
npm install
npm run build
pm2 restart all
```