# CRM WhatsApp AI - Complete Installation System

This directory contains the complete installation system for the CRM WhatsApp AI platform.

## 📦 Installation via SSH

### Quick Installation
```bash
# Download and run installer
curl -fsSL https://raw.githubusercontent.com/PastorStudio/geminiaicrm/main/NEW/installer/install.sh | sudo bash
```

### Manual Installation
```bash
# Download installer
wget https://raw.githubusercontent.com/PastorStudio/geminiaicrm/main/NEW/installer/install.sh

# Make executable
chmod +x install.sh

# Run installer
sudo ./install.sh
```

## 🔧 What Gets Installed

### System Components
- **Node.js 18** - Runtime environment
- **PostgreSQL 15** - Database server
- **Nginx** - Web server and reverse proxy
- **PM2** - Process manager
- **Certbot** - SSL certificate management

### Application Components
- **Backend Server** - Express.js API server
- **Frontend Application** - React-based user interface
- **WhatsApp Integration** - Real-time messaging system
- **AI Processing** - Multi-provider AI integration

### Security Features
- **SSL/TLS Encryption** - Automatic certificate generation
- **Firewall Configuration** - Secure port management
- **Environment Isolation** - Dedicated service user
- **Database Security** - Encrypted connections

## 📁 Directory Structure

```
/opt/crm-whatsapp-ai/          # Main application directory
├── server/                    # Backend server files
├── client/                    # Frontend application files
├── shared/                    # Shared type definitions
├── dist/                      # Built application files
├── whatsapp-sessions/         # WhatsApp session data
├── uploads/                   # File uploads
└── logs/                      # Application logs

/var/log/crm-whatsapp-ai/      # System logs
/opt/backups/crm-whatsapp-ai/  # Automated backups
```

## 🚀 Post-Installation Setup

### 1. Configure API Keys
```bash
sudo nano /opt/crm-whatsapp-ai/.env
```

Add your API keys:
```env
OPENAI_API_KEY=sk-your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
```

### 2. Restart Application
```bash
crm-whatsapp-ai restart
```

### 3. Access Application
- **URL**: `https://your-domain.com`
- **Admin Login**: `admin` / `admin123`

## 🛠️ Management Commands

### Application Control
```bash
crm-whatsapp-ai start      # Start the application
crm-whatsapp-ai stop       # Stop the application
crm-whatsapp-ai restart    # Restart the application
crm-whatsapp-ai status     # Check application status
crm-whatsapp-ai logs       # View application logs
crm-whatsapp-ai update     # Update from GitHub
```

### Database Management
```bash
# Connect to database
sudo -u postgres psql crm_whatsapp_ai

# Run migrations
sudo -u crmwhatsapp bash -c "cd /opt/crm-whatsapp-ai && npm run db:push"
```

### Backup Management
```bash
# Create manual backup
backup-crm-whatsapp-ai

# View backups
ls -la /opt/backups/crm-whatsapp-ai/
```

## 🔍 Troubleshooting

### Check Application Status
```bash
crm-whatsapp-ai status
sudo systemctl status nginx
sudo systemctl status postgresql
```

### View Logs
```bash
# Application logs
crm-whatsapp-ai logs

# System logs
tail -f /var/log/crm-whatsapp-ai/combined.log
tail -f /var/log/nginx/error.log
```

### Common Issues

#### Application Won't Start
1. Check if all services are running
2. Verify environment variables
3. Check database connectivity
4. Review application logs

#### SSL Certificate Issues
```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
sudo -u crmwhatsapp psql -h localhost -d crm_whatsapp_ai
```

## 📋 System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB
- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### Recommended Requirements
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 50GB SSD
- **Network**: Stable internet connection

## 🔒 Security Considerations

### Firewall Ports
- **22** - SSH access
- **80** - HTTP (redirects to HTTPS)
- **443** - HTTPS

### Data Protection
- All sensitive data is encrypted
- Regular automated backups
- Secure session management
- API key protection

## 📞 Support

### Log Files
- Installation: `/var/log/install-crm-whatsapp-ai.log`
- Application: `/var/log/crm-whatsapp-ai/`
- Nginx: `/var/log/nginx/`
- PostgreSQL: `/var/log/postgresql/`

### Configuration Files
- Application: `/opt/crm-whatsapp-ai/.env`
- Nginx: `/etc/nginx/sites-available/crm-whatsapp-ai`
- PM2: `/opt/crm-whatsapp-ai/ecosystem.config.js`