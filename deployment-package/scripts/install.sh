#!/bin/bash

# Script de instalación automática del Sistema CRM WhatsApp AI
# Autor: Sistema CRM WhatsApp AI
# Fecha: Junio 2025

set -e  # Salir en caso de error

echo "🚀 Iniciando instalación del Sistema CRM WhatsApp AI..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
show_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

show_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

show_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que se ejecuta como root o con sudo
if [[ $EUID -eq 0 ]]; then
   show_warning "Ejecutándose como root. Se recomienda usar un usuario normal con sudo."
fi

# Variables de configuración
PROJECT_DIR="/var/www/crm-whatsapp-ai"
DB_NAME="crm_whatsapp_ai"
DB_USER="crm_user"
CURRENT_DIR=$(pwd)

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para instalar Node.js
install_nodejs() {
    show_message "Instalando Node.js v18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    
    # Verificar instalación
    node_version=$(node --version)
    npm_version=$(npm --version)
    show_message "Node.js instalado: $node_version"
    show_message "NPM instalado: $npm_version"
}

# Función para instalar PostgreSQL
install_postgresql() {
    show_message "Instalando PostgreSQL..."
    sudo apt update
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
    show_message "PostgreSQL instalado y configurado"
}

# Función para configurar base de datos
setup_database() {
    show_message "Configurando base de datos PostgreSQL..."
    
    # Generar contraseña aleatoria si no se proporciona
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(openssl rand -base64 32)
        echo "Contraseña generada automáticamente para la base de datos"
    fi
    
    # Crear usuario y base de datos
    sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER USER $DB_USER CREATEDB;
\q
EOF
    
    show_message "Base de datos configurada:"
    echo "  - Nombre: $DB_NAME"
    echo "  - Usuario: $DB_USER"
    echo "  - Contraseña: $DB_PASSWORD"
    
    # Guardar credenciales
    echo "export DB_PASSWORD='$DB_PASSWORD'" >> ~/.bashrc
}

# Función para instalar PM2
install_pm2() {
    show_message "Instalando PM2..."
    sudo npm install -g pm2
    sudo npm install -g tsx
    show_message "PM2 instalado globalmente"
}

# Función para copiar archivos del proyecto
copy_project_files() {
    show_message "Copiando archivos del proyecto a $PROJECT_DIR..."
    
    sudo mkdir -p $PROJECT_DIR
    sudo cp -r $CURRENT_DIR/* $PROJECT_DIR/
    sudo chown -R $USER:$USER $PROJECT_DIR
    
    show_message "Archivos copiados exitosamente"
}

# Función para instalar dependencias del backend
install_backend_deps() {
    show_message "Instalando dependencias del backend..."
    cd $PROJECT_DIR/backend
    npm install
    show_message "Dependencias del backend instaladas"
}

# Función para instalar dependencias del frontend
install_frontend_deps() {
    show_message "Instalando dependencias del frontend..."
    cd $PROJECT_DIR/frontend
    npm install
    show_message "Dependencias del frontend instaladas"
}

# Función para configurar variables de entorno
setup_env_vars() {
    show_message "Configurando variables de entorno..."
    
    cd $PROJECT_DIR/backend
    
    # Crear archivo .env desde .env.example
    cp .env.example .env
    
    # Actualizar DATABASE_URL con credenciales reales
    sed -i "s|postgresql://usuario:password@localhost:5432/crm_whatsapp_ai|postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME|g" .env
    
    # Generar secreto de sesión
    SESSION_SECRET=$(openssl rand -base64 64)
    sed -i "s|tu_secreto_de_sesion_muy_seguro_aqui|$SESSION_SECRET|g" .env
    
    show_message "Variables de entorno configuradas en backend/.env"
    
    # Configurar frontend
    cd $PROJECT_DIR/frontend
    cp .env.example .env
    
    show_message "Variables de entorno configuradas"
}

# Función para ejecutar migraciones
run_migrations() {
    show_message "Ejecutando migraciones de base de datos..."
    cd $PROJECT_DIR/backend
    npm run db:push
    show_message "Migraciones ejecutadas exitosamente"
}

# Función para compilar frontend
build_frontend() {
    show_message "Compilando frontend para producción..."
    cd $PROJECT_DIR/frontend
    npm run build
    show_message "Frontend compilado exitosamente"
}

# Función para configurar servicios
setup_services() {
    show_message "Configurando servicios del sistema..."
    
    # Actualizar rutas en ecosystem.config.js
    cd $PROJECT_DIR
    sed -i "s|/var/www/crm-whatsapp-ai|$PROJECT_DIR|g" ecosystem.config.js
    
    # Crear directorios de logs
    mkdir -p $PROJECT_DIR/logs
    
    show_message "Servicios configurados"
}

# Función para configurar firewall
setup_firewall() {
    show_message "Configurando firewall..."
    
    if command_exists ufw; then
        sudo ufw allow ssh
        sudo ufw allow 80
        sudo ufw allow 443
        sudo ufw allow 5000
        sudo ufw allow 3000
        sudo ufw --force enable
        show_message "Firewall configurado"
    else
        show_warning "UFW no está instalado. Configura el firewall manualmente."
    fi
}

# Función principal de instalación
main() {
    show_message "=== INSTALACIÓN DEL SISTEMA CRM WHATSAPP AI ==="
    
    # Verificar sistema operativo
    if [[ ! -f /etc/debian_version ]]; then
        show_error "Este script está diseñado para sistemas basados en Debian/Ubuntu"
        exit 1
    fi
    
    # Actualizar sistema
    show_message "Actualizando sistema..."
    sudo apt update && sudo apt upgrade -y
    
    # Instalar dependencias básicas
    show_message "Instalando dependencias básicas..."
    sudo apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates build-essential
    
    # Verificar e instalar Node.js
    if ! command_exists node; then
        install_nodejs
    else
        show_message "Node.js ya está instalado: $(node --version)"
    fi
    
    # Verificar e instalar PostgreSQL
    if ! command_exists psql; then
        install_postgresql
    else
        show_message "PostgreSQL ya está instalado"
    fi
    
    # Instalar PM2
    if ! command_exists pm2; then
        install_pm2
    else
        show_message "PM2 ya está instalado"
    fi
    
    # Copiar archivos del proyecto
    copy_project_files
    
    # Configurar base de datos
    setup_database
    
    # Configurar variables de entorno
    setup_env_vars
    
    # Instalar dependencias
    install_backend_deps
    install_frontend_deps
    
    # Ejecutar migraciones
    run_migrations
    
    # Compilar frontend
    build_frontend
    
    # Configurar servicios
    setup_services
    
    # Configurar firewall
    setup_firewall
    
    show_message "=== INSTALACIÓN COMPLETADA ==="
    echo ""
    echo -e "${GREEN}✅ Sistema CRM WhatsApp AI instalado exitosamente${NC}"
    echo ""
    echo "📋 Información del sistema:"
    echo "  - Directorio: $PROJECT_DIR"
    echo "  - Base de datos: $DB_NAME"
    echo "  - Usuario DB: $DB_USER"
    echo "  - Contraseña DB: $DB_PASSWORD"
    echo ""
    echo "🚀 Para iniciar el sistema:"
    echo "  cd $PROJECT_DIR"
    echo "  pm2 start ecosystem.config.js"
    echo ""
    echo "📊 Para monitorear:"
    echo "  pm2 list"
    echo "  pm2 logs"
    echo "  pm2 monit"
    echo ""
    echo "⚠️  IMPORTANTE: Configura las API keys en $PROJECT_DIR/backend/.env"
    echo "   - OPENAI_API_KEY"
    echo "   - GOOGLE_AI_API_KEY"
    echo "   - QWEN_API_KEY"
    echo ""
    echo "🌐 El sistema estará disponible en:"
    echo "  - Frontend: http://localhost:3000"
    echo "  - Backend: http://localhost:5000"
}

# Manejo de señales
trap 'show_error "Instalación interrumpida"; exit 1' INT TERM

# Ejecutar instalación
main "$@"