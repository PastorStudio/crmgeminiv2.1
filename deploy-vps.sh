#!/bin/bash

# WhatsApp CRM System - Auto Deployment Script for VPS
# Compatible with Ubuntu 20.04/22.04, Debian 10/11
# Works with AAPanel, Direct SSH, Bitvise

set -e

echo "🚀 Starting WhatsApp CRM System Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_warning "This script should not be run as root for security reasons"
   print_warning "Please run as a regular user with sudo privileges"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
print_status "Installing essential packages..."
sudo apt install -y curl wget git build-essential python3-pip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 20
print_status "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
fi

# Install PostgreSQL
print_status "Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
else
    print_status "PostgreSQL already installed"
fi

# Setup PostgreSQL database
print_status "Setting up PostgreSQL database..."
DB_NAME="whatsapp_crm_db"
DB_USER="whatsapp_user"
DB_PASSWORD=$(openssl rand -base64 32)

sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true

# Install PM2 globally
print_status "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
else
    print_status "PM2 already installed: $(pm2 --version)"
fi

# Install project dependencies
print_status "Installing project dependencies..."
npm install

# Create environment file
print_status "Creating environment configuration..."
if [ ! -f .env ]; then
    cp .env.example .env
    
    # Update .env with database credentials
    sed -i "s|DATABASE_URL=.*|DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\"|g" .env
    sed -i "s|PGUSER=.*|PGUSER=$DB_USER|g" .env
    sed -i "s|PGPASSWORD=.*|PGPASSWORD=$DB_PASSWORD|g" .env
    sed -i "s|PGDATABASE=.*|PGDATABASE=$DB_NAME|g" .env
    sed -i "s|PGHOST=.*|PGHOST=localhost|g" .env
    sed -i "s|PGPORT=.*|PGPORT=5432|g" .env
    
    print_status "Environment file created. Please add your API keys to .env file:"
    print_warning "Required: OPENAI_API_KEY"
    print_warning "Edit .env file and add your API keys, then run: pm2 start ecosystem.config.js"
else
    print_status ".env file already exists"
fi

# Build the application
print_status "Building application..."
npm run build

# Setup database schema
print_status "Setting up database schema..."
npm run db:push

# Install Nginx (optional)
read -p "Do you want to install and configure Nginx? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Installing Nginx..."
    sudo apt install -y nginx
    
    # Create Nginx configuration
    sudo tee /etc/nginx/sites-available/whatsapp-crm > /dev/null <<EOF
server {
    listen 80;
    server_name _;

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
}
EOF

    sudo ln -sf /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t && sudo systemctl restart nginx
    sudo systemctl enable nginx
    
    print_status "Nginx configured successfully"
fi

# Setup firewall
print_status "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3000
sudo ufw --force enable

# Create startup script
print_status "Creating startup script..."
cat > start-app.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
npm run build
pm2 start ecosystem.config.js
pm2 save
EOF

chmod +x start-app.sh

print_status "✅ Deployment completed successfully!"
echo
print_status "Database Configuration:"
echo "  - Database: $DB_NAME"
echo "  - User: $DB_USER"
echo "  - Password: $DB_PASSWORD"
echo
print_status "Next Steps:"
echo "1. Edit .env file and add your API keys:"
echo "   nano .env"
echo
echo "2. Start the application:"
echo "   pm2 start ecosystem.config.js"
echo
echo "3. Set PM2 to start on boot:"
echo "   pm2 startup"
echo "   pm2 save"
echo
echo "4. View application logs:"
echo "   pm2 logs"
echo
echo "5. Access your application:"
if command -v nginx &> /dev/null; then
    echo "   http://your-server-ip (via Nginx)"
else
    echo "   http://your-server-ip:3000"
fi
echo
print_status "🎉 WhatsApp CRM System is ready to use!"