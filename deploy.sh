#!/bin/bash

# CRM WhatsApp AI - Deployment Script
# This script automates the deployment process for production environments

set -e

echo "🚀 Starting CRM WhatsApp AI Deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is available"
}

# Check if Docker Compose is installed
check_docker_compose() {
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p temp
    mkdir -p whatsapp-sessions
    mkdir -p ssl
    
    print_success "Directories created"
}

# Generate SSL certificates (self-signed for development)
generate_ssl_certs() {
    if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
        print_status "Generating SSL certificates..."
        
        openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        print_success "SSL certificates generated"
    else
        print_status "SSL certificates already exist"
    fi
}

# Check environment variables
check_environment() {
    print_status "Checking environment variables..."
    
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration before proceeding"
        read -p "Press Enter after configuring .env file..."
    fi
    
    # Source environment variables
    set -a
    source .env
    set +a
    
    # Check critical environment variables
    required_vars=("OPENAI_API_KEY" "POSTGRES_PASSWORD" "JWT_SECRET" "SESSION_SECRET")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_error "Missing required environment variables:"
        printf '  - %s\n' "${missing_vars[@]}"
        exit 1
    fi
    
    print_success "Environment variables configured"
}

# Build and start services
deploy_services() {
    print_status "Building and starting services..."
    
    # Stop any existing containers
    docker-compose down --remove-orphans
    
    # Build and start services
    docker-compose up --build -d
    
    print_success "Services deployed"
}

# Wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to be ready..."
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    timeout 60s bash -c 'until docker-compose exec -T postgres pg_isready -U postgres; do sleep 2; done'
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    timeout 60s bash -c 'until docker-compose exec -T redis redis-cli ping | grep PONG; do sleep 2; done'
    
    # Wait for main application
    print_status "Waiting for main application..."
    timeout 120s bash -c 'until curl -f http://localhost:3000/api/health; do sleep 5; done'
    
    print_success "All services are ready"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # The init.sql file is automatically executed by PostgreSQL on first startup
    # Additional migrations can be run here if needed
    
    print_success "Database initialized"
}

# Display deployment information
display_info() {
    print_success "🎉 Deployment completed successfully!"
    echo
    echo "📋 Application Information:"
    echo "  - Application URL: http://localhost:3000"
    echo "  - Database: PostgreSQL on port 5432"
    echo "  - Redis: Available on port 6379"
    echo
    echo "👤 Default Credentials:"
    echo "  - Admin: admin / admin123"
    echo "  - Agent: agent / agent123"
    echo
    echo "📝 Next Steps:"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Login with admin credentials"
    echo "  3. Configure WhatsApp accounts"
    echo "  4. Set up AI API keys in the admin panel"
    echo
    echo "📊 Service Status:"
    docker-compose ps
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Cleaning up..."
        docker-compose down --remove-orphans
    fi
}

# Main deployment function
main() {
    trap cleanup EXIT
    
    print_status "CRM WhatsApp AI Deployment Script"
    echo "=================================="
    
    check_docker
    check_docker_compose
    create_directories
    generate_ssl_certs
    check_environment
    deploy_services
    wait_for_services
    run_migrations
    display_info
}

# Run main function
main "$@"