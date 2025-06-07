#!/bin/bash

# WhatsApp CRM - One-Click VPS Installation
# For Ubuntu 20.04/22.04 and Debian 10/11

set -e

echo "🚀 WhatsApp CRM System - Quick Install for VPS"
echo "=============================================="

# Check if git is available
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    sudo apt update && sudo apt install -y git
fi

# Get the repository
read -p "Enter your GitHub repository URL (or press Enter for default setup): " REPO_URL
if [ -z "$REPO_URL" ]; then
    REPO_URL="https://github.com/yourusername/whatsapp-crm-system.git"
fi

# Clone repository
PROJECT_DIR="whatsapp-crm-system"
if [ -d "$PROJECT_DIR" ]; then
    echo "Directory exists. Updating..."
    cd $PROJECT_DIR
    git pull origin main
else
    echo "Cloning repository..."
    git clone $REPO_URL $PROJECT_DIR
    cd $PROJECT_DIR
fi

# Make deployment script executable
chmod +x deploy-vps.sh

# Run the full deployment
echo "Starting automated deployment..."
./deploy-vps.sh

echo ""
echo "✅ Quick installation completed!"
echo ""
echo "Next steps:"
echo "1. Edit .env file: nano .env"
echo "2. Add your OPENAI_API_KEY"
echo "3. Start the application: pm2 start ecosystem.config.js"
echo "4. Access at: http://your-server-ip:3000"