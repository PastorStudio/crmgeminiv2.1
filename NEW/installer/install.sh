#!/bin/bash

# ===================================================================
# CRM WhatsApp AI - Complete System Installer
# Installs backend and frontend components via SSH
# ===================================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/crm-whatsapp-ai"
SERVICE_USER="crmwhatsapp"
DATABASE_NAME="crm_whatsapp_ai"
NODE_VERSION="18"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

# Function to detect OS
detect_os() {
    if [[ -f /etc/debian_version ]]; then
        OS="debian"
        print_status "Detected Debian/Ubuntu system"
    elif [[ -f /etc/redhat-release ]]; then
        OS="redhat"
        print_status "Detected RedHat/CentOS system"
    else
        print_error "Unsupported operating system"
        exit 1
    fi
}

# Function to install system dependencies
install_system_dependencies() {
    print_step "Installing system dependencies..."
    
    if [[ $OS == "debian" ]]; then
        apt-get update
        apt-get install -y curl wget git unzip build-essential \
            postgresql postgresql-contrib nginx certbot \
            python3-certbot-nginx software-properties-common \
            ca-certificates gnupg lsb-release
    elif [[ $OS == "redhat" ]]; then
        yum update -y
        yum install -y curl wget git unzip gcc gcc-c++ make \
            postgresql-server postgresql-contrib nginx certbot \
            python3-certbot-nginx epel-release
        postgresql-setup initdb
        systemctl enable postgresql
        systemctl start postgresql
    fi
    
    print_status "System dependencies installed"
}

# Function to install Node.js
install_nodejs() {
    print_step "Installing Node.js ${NODE_VERSION}..."
    
    # Install Node.js from NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    
    if [[ $OS == "debian" ]]; then
        apt-get install -y nodejs
    elif [[ $OS == "redhat" ]]; then
        yum install -y nodejs npm
    fi
    
    # Install global packages
    npm install -g pm2 typescript tsx
    
    print_status "Node.js $(node --version) installed"
    print_status "NPM $(npm --version) installed"
}

# Function to create service user
create_service_user() {
    print_step "Creating service user..."
    
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd -r -s /bin/bash -d $INSTALL_DIR $SERVICE_USER
        print_status "User $SERVICE_USER created"
    else
        print_warning "User $SERVICE_USER already exists"
    fi
}

# Function to setup PostgreSQL
setup_postgresql() {
    print_step "Setting up PostgreSQL..."
    
    systemctl enable postgresql
    systemctl start postgresql
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE $DATABASE_NAME;" 2>/dev/null || print_warning "Database already exists"
    sudo -u postgres psql -c "CREATE USER $SERVICE_USER WITH PASSWORD 'secure_password_123';" 2>/dev/null || print_warning "User already exists"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DATABASE_NAME TO $SERVICE_USER;"
    sudo -u postgres psql -c "ALTER USER $SERVICE_USER CREATEDB;"
    
    print_status "PostgreSQL configured"
}

# Function to download and setup application
setup_application() {
    print_step "Setting up application..."
    
    # Create install directory
    mkdir -p $INSTALL_DIR
    cd $INSTALL_DIR
    
    # Download from GitHub (replace with actual repo)
    if [[ ! -d ".git" ]]; then
        git clone https://github.com/PastorStudio/geminiaicrm.git .
    else
        git pull origin main
    fi
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR
    
    print_status "Application downloaded"
}

# Function to install dependencies
install_dependencies() {
    print_step "Installing application dependencies..."
    
    sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && npm install"
    
    print_status "Dependencies installed"
}

# Function to build application
build_application() {
    print_step "Building application..."
    
    sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && npm run build"
    
    print_status "Application built"
}

# Function to setup environment
setup_environment() {
    print_step "Setting up environment..."
    
    cat > $INSTALL_DIR/.env << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://$SERVICE_USER:secure_password_123@localhost:5432/$DATABASE_NAME
POSTGRES_PASSWORD=secure_password_123

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# API Keys (to be configured)
OPENAI_API_KEY=
GEMINI_API_KEY=

# Application URLs
FRONTEND_URL=https://$(hostname -f)
API_BASE_URL=https://$(hostname -f)

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/crm-whatsapp-ai/app.log
EOF
    
    chown $SERVICE_USER:$SERVICE_USER $INSTALL_DIR/.env
    chmod 600 $INSTALL_DIR/.env
    
    print_status "Environment configured"
}

# Function to setup PM2 service
setup_pm2_service() {
    print_step "Setting up PM2 service..."
    
    # Create PM2 ecosystem file
    cat > $INSTALL_DIR/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'crm-whatsapp-ai',
    script: './dist/server/index.js',
    cwd: '$INSTALL_DIR',
    user: '$SERVICE_USER',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/crm-whatsapp-ai/combined.log',
    out_file: '/var/log/crm-whatsapp-ai/out.log',
    error_file: '/var/log/crm-whatsapp-ai/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF
    
    # Create log directory
    mkdir -p /var/log/crm-whatsapp-ai
    chown $SERVICE_USER:$SERVICE_USER /var/log/crm-whatsapp-ai
    
    # Setup PM2 as service user
    sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 start ecosystem.config.js"
    sudo -u $SERVICE_USER bash -c "pm2 save"
    sudo -u $SERVICE_USER bash -c "pm2 startup"
    
    print_status "PM2 service configured"
}

# Function to setup Nginx
setup_nginx() {
    print_step "Setting up Nginx..."
    
    cat > /etc/nginx/sites-available/crm-whatsapp-ai << EOF
server {
    listen 80;
    server_name $(hostname -f);
    
    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $(hostname -f);
    
    # SSL Configuration (certificates will be added by certbot)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    
    # Static files
    location /static/ {
        alias $INSTALL_DIR/dist/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket for real-time features
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Main application
    location / {
        proxy_pass http://localhost:3000;
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
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/crm-whatsapp-ai /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    
    print_status "Nginx configured"
}

# Function to setup SSL certificate
setup_ssl() {
    print_step "Setting up SSL certificate..."
    
    print_warning "Please ensure your domain points to this server's IP address"
    read -p "Press Enter to continue with SSL setup..."
    
    certbot --nginx -d $(hostname -f) --non-interactive --agree-tos --email admin@$(hostname -f)
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    print_status "SSL certificate configured"
}

# Function to setup database schema
setup_database_schema() {
    print_step "Setting up database schema..."
    
    sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && npm run db:push"
    
    print_status "Database schema created"
}

# Function to create startup script
create_startup_script() {
    print_step "Creating startup script..."
    
    cat > /usr/local/bin/crm-whatsapp-ai << EOF
#!/bin/bash
case "\$1" in
    start)
        sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 start ecosystem.config.js"
        ;;
    stop)
        sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 stop crm-whatsapp-ai"
        ;;
    restart)
        sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 restart crm-whatsapp-ai"
        ;;
    status)
        sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 status"
        ;;
    logs)
        sudo -u $SERVICE_USER bash -c "cd $INSTALL_DIR && pm2 logs crm-whatsapp-ai"
        ;;
    update)
        cd $INSTALL_DIR
        git pull origin main
        sudo -u $SERVICE_USER npm install
        sudo -u $SERVICE_USER npm run build
        sudo -u $SERVICE_USER npm run db:push
        sudo -u $SERVICE_USER pm2 restart crm-whatsapp-ai
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|status|logs|update}"
        exit 1
        ;;
esac
EOF
    
    chmod +x /usr/local/bin/crm-whatsapp-ai
    
    print_status "Startup script created"
}

# Function to setup firewall
setup_firewall() {
    print_step "Setting up firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow ssh
        ufw allow http
        ufw allow https
        ufw --force enable
    elif command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --reload
    fi
    
    print_status "Firewall configured"
}

# Function to create backup script
create_backup_script() {
    print_step "Creating backup script..."
    
    cat > /usr/local/bin/backup-crm-whatsapp-ai << EOF
#!/bin/bash
BACKUP_DIR="/opt/backups/crm-whatsapp-ai"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup database
pg_dump -U $SERVICE_USER -h localhost $DATABASE_NAME > \$BACKUP_DIR/database_\$DATE.sql

# Backup application files
tar -czf \$BACKUP_DIR/app_\$DATE.tar.gz -C $INSTALL_DIR --exclude=node_modules --exclude=dist .

# Backup WhatsApp sessions
tar -czf \$BACKUP_DIR/sessions_\$DATE.tar.gz -C $INSTALL_DIR whatsapp-sessions/

# Keep only last 7 backups
find \$BACKUP_DIR -name "*.sql" -mtime +7 -delete
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR"
EOF
    
    chmod +x /usr/local/bin/backup-crm-whatsapp-ai
    
    # Schedule daily backups
    echo "0 2 * * * /usr/local/bin/backup-crm-whatsapp-ai" | crontab -
    
    print_status "Backup script created and scheduled"
}

# Function to print completion message
print_completion() {
    print_status "=========================================="
    print_status "CRM WhatsApp AI Installation Complete!"
    print_status "=========================================="
    echo ""
    print_status "Application is running at: https://$(hostname -f)"
    print_status "Database: PostgreSQL on localhost:5432"
    print_status "Application directory: $INSTALL_DIR"
    print_status "Service user: $SERVICE_USER"
    echo ""
    print_status "Management commands:"
    print_status "  crm-whatsapp-ai start     - Start the application"
    print_status "  crm-whatsapp-ai stop      - Stop the application"
    print_status "  crm-whatsapp-ai restart   - Restart the application"
    print_status "  crm-whatsapp-ai status    - Check application status"
    print_status "  crm-whatsapp-ai logs      - View application logs"
    print_status "  crm-whatsapp-ai update    - Update from GitHub"
    echo ""
    print_status "Backup command:"
    print_status "  backup-crm-whatsapp-ai    - Create manual backup"
    echo ""
    print_warning "IMPORTANT: Configure your API keys in $INSTALL_DIR/.env"
    print_warning "Required API keys: OPENAI_API_KEY, GEMINI_API_KEY"
    echo ""
    print_status "Installation log: /var/log/install-crm-whatsapp-ai.log"
}

# Main installation function
main() {
    print_status "Starting CRM WhatsApp AI installation..."
    
    # Log installation
    exec > >(tee -a /var/log/install-crm-whatsapp-ai.log)
    exec 2>&1
    
    check_root
    detect_os
    install_system_dependencies
    install_nodejs
    create_service_user
    setup_postgresql
    setup_application
    install_dependencies
    build_application
    setup_environment
    setup_database_schema
    setup_pm2_service
    setup_nginx
    setup_ssl
    setup_firewall
    create_startup_script
    create_backup_script
    
    print_completion
}

# Run main function
main "$@"