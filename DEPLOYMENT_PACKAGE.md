# CRM WhatsApp AI - Complete Deployment Package

This package contains all necessary files and configurations for deploying the CRM WhatsApp AI system in production environments.

## 📦 Package Contents

### Core Deployment Files
- `Dockerfile` - Multi-stage Docker container configuration
- `docker-compose.yml` - Complete orchestration with PostgreSQL and Redis
- `nginx.conf` - Production-ready reverse proxy configuration
- `easypanel.yml` - EasyPanel cloud deployment configuration
- `deploy.sh` - Automated deployment script
- `init.sql` - Database initialization and schema setup
- `.env.example` - Environment variables template

### Application Structure
- Complete TypeScript/React frontend with Vite
- Express.js backend with WebSocket support
- PostgreSQL database with Drizzle ORM
- Redis for session management
- Multi-AI provider integration (OpenAI, Gemini, Anthropic)

## 🚀 Deployment Options

### Option 1: Docker Compose (Recommended)

**Prerequisites:**
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum
- 20GB disk space

**Quick Start:**
```bash
# Clone or extract the deployment package
cd crm-whatsapp-ai

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run automated deployment
chmod +x deploy.sh
./deploy.sh
```

**Manual Deployment:**
```bash
# Build and start services
docker-compose up --build -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f app
```

### Option 2: EasyPanel Cloud Deployment

**Prerequisites:**
- EasyPanel account
- Domain name (optional)

**Steps:**
1. Upload project files to EasyPanel
2. Import `easypanel.yml` configuration
3. Configure required secrets in EasyPanel dashboard
4. Deploy with one-click

**Required Secrets in EasyPanel:**
```
POSTGRES_PASSWORD=your_secure_password
OPENAI_API_KEY=sk-your_openai_key
GEMINI_API_KEY=your_gemini_key
JWT_SECRET=your_jwt_secret_min_32_chars
SESSION_SECRET=your_session_secret_min_32_chars
```

### Option 3: Manual Server Deployment

**Prerequisites:**
- Ubuntu 20.04+ or similar
- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Nginx

**Installation Steps:**
```bash
# Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql redis-server nginx

# Setup database
sudo -u postgres createdb crm_whatsapp_ai
sudo -u postgres psql crm_whatsapp_ai < init.sql

# Install application
npm install
npm run build

# Configure Nginx
sudo cp nginx.conf /etc/nginx/sites-available/crm-whatsapp-ai
sudo ln -s /etc/nginx/sites-available/crm-whatsapp-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Start application
npm start
```

## ⚙️ Configuration

### Environment Variables

**Database Configuration:**
```env
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_PASSWORD=secure_password_2024
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGDATABASE=crm_whatsapp_ai
```

**AI Services:**
```env
OPENAI_API_KEY=sk-your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

**Security:**
```env
JWT_SECRET=your_jwt_secret_minimum_32_characters
SESSION_SECRET=your_session_secret_minimum_32_characters
```

**Application:**
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-domain.com
API_BASE_URL=https://your-domain.com
```

### SSL Certificate Configuration

**For Production (Let's Encrypt):**
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

**For Development (Self-signed):**
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes
```

## 🔐 Security Considerations

### Required Secrets
1. **OPENAI_API_KEY** - OpenAI API access for AI responses
2. **POSTGRES_PASSWORD** - Database security
3. **JWT_SECRET** - User authentication tokens
4. **SESSION_SECRET** - Session encryption

### Security Features
- HTTPS enforcement
- Rate limiting (10 req/s API, 5 req/m auth)
- SQL injection protection via Drizzle ORM
- XSS protection headers
- CSRF protection
- Session encryption

### Firewall Configuration
```bash
# Allow necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## 📊 Performance Optimization

### Resource Allocation
- **Minimum:** 2 CPU cores, 4GB RAM, 20GB storage
- **Recommended:** 4 CPU cores, 8GB RAM, 50GB storage
- **High Load:** 8+ CPU cores, 16GB+ RAM, 100GB+ storage

### Database Optimization
```sql
-- PostgreSQL performance settings
shared_buffers = '256MB'
effective_cache_size = '1GB'
work_mem = '64MB'
maintenance_work_mem = '256MB'
```

### Redis Configuration
```conf
# Redis optimization
maxmemory 512mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## 🔍 Monitoring and Logging

### Health Checks
- Application: `GET /api/health`
- Database: PostgreSQL connection test
- Redis: PING command
- WhatsApp: Connection status monitoring

### Log Locations
```
/app/logs/app.log         # Application logs
/var/log/nginx/access.log # Nginx access logs
/var/log/nginx/error.log  # Nginx error logs
/var/log/postgresql/      # PostgreSQL logs
/var/log/redis/           # Redis logs
```

### Monitoring Commands
```bash
# Check service status
docker-compose ps
systemctl status nginx
systemctl status postgresql
systemctl status redis

# View real-time logs
docker-compose logs -f app
tail -f /app/logs/app.log

# Monitor resources
docker stats
htop
```

## 🔄 Backup and Recovery

### Database Backup
```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres crm_whatsapp_ai > backup.sql

# Restore backup
docker-compose exec -T postgres psql -U postgres crm_whatsapp_ai < backup.sql
```

### Full System Backup
```bash
# Backup application data
tar -czf backup-$(date +%Y%m%d).tar.gz \
  whatsapp-sessions/ \
  uploads/ \
  logs/ \
  .env

# Backup database
docker-compose exec postgres pg_dump -U postgres crm_whatsapp_ai > db-backup-$(date +%Y%m%d).sql
```

### Automated Backup Script
```bash
#!/bin/bash
# Daily backup script
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d)

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
docker-compose exec postgres pg_dump -U postgres crm_whatsapp_ai > $BACKUP_DIR/db-$DATE.sql

# Application data backup
tar -czf $BACKUP_DIR/app-data-$DATE.tar.gz whatsapp-sessions/ uploads/ logs/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "*.sql" -mtime +30 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check logs
docker-compose logs app

# Common fixes
docker-compose down
docker-compose up --build -d
```

**Database connection issues:**
```bash
# Check PostgreSQL status
docker-compose exec postgres pg_isready

# Reset database
docker-compose down -v
docker-compose up -d
```

**WhatsApp connection problems:**
```bash
# Clear WhatsApp sessions
rm -rf whatsapp-sessions/*

# Restart application
docker-compose restart app
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Optimize database
docker-compose exec postgres psql -U postgres crm_whatsapp_ai -c "VACUUM ANALYZE;"

# Clear Redis cache
docker-compose exec redis redis-cli FLUSHALL
```

## 📧 Support

### Default Credentials
- **Admin:** admin / admin123
- **Agent:** agent / agent123

### API Documentation
Visit `/api/docs` after deployment for complete API documentation.

### System Requirements Verification
```bash
# Check system requirements
./deploy.sh --check-requirements

# Verify installation
curl -f http://localhost:3000/api/health
```

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and deploy
docker-compose down
docker-compose up --build -d

# Run migrations if needed
docker-compose exec app npm run db:push
```

### Regular Maintenance Tasks
```bash
# Weekly database maintenance
docker-compose exec postgres psql -U postgres crm_whatsapp_ai -c "VACUUM ANALYZE;"

# Log rotation
logrotate /etc/logrotate.d/crm-whatsapp-ai

# Security updates
sudo apt update && sudo apt upgrade
```

This deployment package provides everything needed for a production-ready CRM WhatsApp AI system with enterprise-level security, monitoring, and scalability features.