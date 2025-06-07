#!/bin/bash

# WhatsApp CRM System - Installation Wizard
# Interactive installer for VPS deployment

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# ASCII Art Logo
show_logo() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║               WhatsApp CRM Installation Wizard              ║"
    echo "║                     Sistema Automático                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Progress bar function
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local percent=$((current * 100 / total))
    local filled=$((percent / 5))
    local empty=$((20 - filled))
    
    printf "\r${BLUE}[%s%s] %d%% - %s${NC}" \
           "$(printf '%*s' $filled | tr ' ' '█')" \
           "$(printf '%*s' $empty | tr ' ' '░')" \
           "$percent" "$message"
}

# Step indicator
show_step() {
    local step=$1
    local title=$2
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}PASO $step: $title${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Success message
show_success() {
    echo -e "\n${GREEN}✓ $1${NC}"
}

# Error message
show_error() {
    echo -e "\n${RED}✗ $1${NC}"
}

# Warning message
show_warning() {
    echo -e "\n${YELLOW}⚠ $1${NC}"
}

# Info message
show_info() {
    echo -e "\n${BLUE}ℹ $1${NC}"
}

# User input with validation
get_user_input() {
    local prompt=$1
    local validation=$2
    local response
    
    while true; do
        echo -e "\n${CYAN}$prompt${NC}"
        read -r response
        
        if [[ -z "$validation" ]] || eval "$validation"; then
            echo "$response"
            return 0
        else
            show_error "Entrada inválida. Intenta de nuevo."
        fi
    done
}

# Yes/No prompt
confirm() {
    local prompt=$1
    local response
    
    while true; do
        echo -e "\n${CYAN}$prompt (s/n): ${NC}"
        read -r response
        case $response in
            [Ss]* ) return 0;;
            [Nn]* ) return 1;;
            * ) show_error "Por favor responde 's' para sí o 'n' para no.";;
        esac
    done
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        show_error "Este script no debe ejecutarse como root por seguridad."
        show_info "Por favor ejecuta como usuario regular con permisos sudo."
        exit 1
    fi
}

# Welcome screen
show_welcome() {
    show_logo
    echo -e "${GREEN}¡Bienvenido al Asistente de Instalación de WhatsApp CRM!${NC}"
    echo -e "${BLUE}Este wizard te guiará paso a paso para instalar el sistema completo.${NC}"
    echo
    echo -e "El proceso incluye:"
    echo -e "  • Instalación de dependencias (Node.js, PostgreSQL, PM2)"
    echo -e "  • Configuración de base de datos"
    echo -e "  • Configuración de servidor web (Nginx)"
    echo -e "  • Configuración de firewall"
    echo -e "  • Configuración de variables de entorno"
    echo
    echo -e "${YELLOW}Tiempo estimado: 10-15 minutos${NC}"
    echo
    
    if ! confirm "¿Deseas continuar con la instalación?"; then
        echo -e "\n${BLUE}Instalación cancelada. ¡Hasta luego!${NC}"
        exit 0
    fi
}

# System check
system_check() {
    show_step 1 "Verificación del Sistema"
    
    show_progress 1 6 "Verificando sistema operativo..."
    sleep 1
    
    if [[ -f /etc/os-release ]]; then
        source /etc/os-release
        if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
            show_error "Sistema operativo no soportado: $PRETTY_NAME"
            show_info "Este wizard funciona con Ubuntu 20.04/22.04 o Debian 10/11"
            exit 1
        fi
        show_success "Sistema operativo compatible: $PRETTY_NAME"
    else
        show_warning "No se pudo determinar el sistema operativo"
    fi
    
    show_progress 2 6 "Verificando conexión a internet..."
    sleep 1
    if ping -c 1 google.com &> /dev/null; then
        show_success "Conexión a internet disponible"
    else
        show_error "No hay conexión a internet"
        exit 1
    fi
    
    show_progress 3 6 "Verificando permisos sudo..."
    sleep 1
    if sudo -n true 2>/dev/null; then
        show_success "Permisos sudo verificados"
    else
        show_warning "Se requerirán permisos sudo durante la instalación"
    fi
    
    show_progress 4 6 "Verificando espacio en disco..."
    sleep 1
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -gt 2097152 ]]; then # 2GB
        show_success "Espacio en disco suficiente"
    else
        show_warning "Poco espacio en disco disponible (recomendado: >2GB)"
    fi
    
    show_progress 5 6 "Verificando memoria RAM..."
    sleep 1
    total_ram=$(free -m | awk 'NR==2{print $2}')
    if [[ $total_ram -gt 1024 ]]; then
        show_success "Memoria RAM suficiente (${total_ram}MB)"
    else
        show_warning "Poca memoria RAM disponible (recomendado: >1GB)"
    fi
    
    show_progress 6 6 "Verificación completada"
    sleep 1
    echo
}

# Configuration input
get_configuration() {
    show_step 2 "Configuración del Sistema"
    
    echo -e "${BLUE}Vamos a configurar tu instalación:${NC}"
    
    # Domain/IP configuration
    echo -e "\n${CYAN}1. Configuración de Dominio/IP${NC}"
    SERVER_IP=$(get_user_input "Ingresa la IP de tu servidor (deja vacío para detectar automáticamente):" "")
    
    if [[ -z "$SERVER_IP" ]]; then
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
        show_info "IP detectada automáticamente: $SERVER_IP"
    fi
    
    # Database configuration
    echo -e "\n${CYAN}2. Configuración de Base de Datos${NC}"
    DB_NAME=$(get_user_input "Nombre de la base de datos [whatsapp_crm_db]:" "")
    DB_NAME=${DB_NAME:-whatsapp_crm_db}
    
    DB_USER=$(get_user_input "Usuario de la base de datos [whatsapp_user]:" "")
    DB_USER=${DB_USER:-whatsapp_user}
    
    DB_PASSWORD=$(openssl rand -base64 16 2>/dev/null || echo "$(date +%s)_secure_password")
    show_info "Contraseña generada automáticamente para seguridad"
    
    # Application configuration
    echo -e "\n${CYAN}3. Configuración de la Aplicación${NC}"
    APP_PORT=$(get_user_input "Puerto de la aplicación [3000]:" '[[ $response =~ ^[0-9]+$ && $response -ge 1000 && $response -le 65535 ]] || [[ -z "$response" ]]')
    APP_PORT=${APP_PORT:-3000}
    
    # Optional components
    echo -e "\n${CYAN}4. Componentes Opcionales${NC}"
    INSTALL_NGINX=false
    if confirm "¿Instalar y configurar Nginx como proxy reverso?"; then
        INSTALL_NGINX=true
    fi
    
    CONFIGURE_SSL=false
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        if confirm "¿Configurar SSL/HTTPS automáticamente? (requiere dominio válido)"; then
            CONFIGURE_SSL=true
            DOMAIN=$(get_user_input "Ingresa tu dominio (ej: tudominio.com):" '[[ $response =~ ^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$ ]]')
        fi
    fi
    
    # API Keys notice
    echo -e "\n${YELLOW}5. Claves API${NC}"
    show_info "Necesitarás configurar las siguientes claves API después de la instalación:"
    echo -e "  • OpenAI API Key (obligatorio)"
    echo -e "  • Otras claves según tus necesidades"
    
    # Summary
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}RESUMEN DE CONFIGURACIÓN:${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Servidor IP/Dominio: $SERVER_IP"
    echo -e "Base de datos: $DB_NAME"
    echo -e "Usuario DB: $DB_USER"
    echo -e "Puerto aplicación: $APP_PORT"
    echo -e "Nginx: $([ "$INSTALL_NGINX" = true ] && echo "Sí" || echo "No")"
    echo -e "SSL/HTTPS: $([ "$CONFIGURE_SSL" = true ] && echo "Sí ($DOMAIN)" || echo "No")"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if ! confirm "¿La configuración es correcta?"; then
        show_info "Reiniciando configuración..."
        get_configuration
        return
    fi
}

# Install dependencies
install_dependencies() {
    show_step 3 "Instalación de Dependencias"
    
    show_progress 1 8 "Actualizando sistema..."
    sudo apt update -qq && sudo apt upgrade -y -qq
    show_success "Sistema actualizado"
    
    show_progress 2 8 "Instalando paquetes esenciales..."
    sudo apt install -y -qq curl wget git build-essential python3-pip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
    show_success "Paquetes esenciales instalados"
    
    show_progress 3 8 "Instalando Node.js 20..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &>/dev/null
        sudo apt-get install -y -qq nodejs
        show_success "Node.js $(node --version) instalado"
    else
        show_success "Node.js ya está instalado: $(node --version)"
    fi
    
    show_progress 4 8 "Instalando PostgreSQL..."
    if ! command -v psql &> /dev/null; then
        sudo apt install -y -qq postgresql postgresql-contrib
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        show_success "PostgreSQL instalado y configurado"
    else
        show_success "PostgreSQL ya está instalado"
    fi
    
    show_progress 5 8 "Instalando PM2..."
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2 &>/dev/null
        show_success "PM2 instalado"
    else
        show_success "PM2 ya está instalado"
    fi
    
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        show_progress 6 8 "Instalando Nginx..."
        if ! command -v nginx &> /dev/null; then
            sudo apt install -y -qq nginx
            sudo systemctl enable nginx
            show_success "Nginx instalado"
        else
            show_success "Nginx ya está instalado"
        fi
    fi
    
    show_progress 7 8 "Configurando firewall..."
    sudo ufw --force enable &>/dev/null
    sudo ufw allow ssh &>/dev/null
    sudo ufw allow $APP_PORT &>/dev/null
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        sudo ufw allow 80 &>/dev/null
        sudo ufw allow 443 &>/dev/null
    fi
    show_success "Firewall configurado"
    
    show_progress 8 8 "Dependencias completadas"
    sleep 1
    echo
}

# Setup database
setup_database() {
    show_step 4 "Configuración de Base de Datos"
    
    show_progress 1 4 "Creando usuario de base de datos..."
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" &>/dev/null || true
    show_success "Usuario $DB_USER creado"
    
    show_progress 2 4 "Creando base de datos..."
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" &>/dev/null || true
    show_success "Base de datos $DB_NAME creada"
    
    show_progress 3 4 "Configurando permisos..."
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" &>/dev/null
    show_success "Permisos configurados"
    
    show_progress 4 4 "Base de datos completada"
    sleep 1
    echo
}

# Install application
install_application() {
    show_step 5 "Instalación de la Aplicación"
    
    show_progress 1 6 "Instalando dependencias del proyecto..."
    npm install &>/dev/null
    show_success "Dependencias instaladas"
    
    show_progress 2 6 "Creando archivo de configuración..."
    cat > .env << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD
PGDATABASE=$DB_NAME
PGHOST=localhost
PGPORT=5432

# Application Configuration
PORT=$APP_PORT
NODE_ENV=production

# Security
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# API Keys (CONFIGURE DESPUÉS DE LA INSTALACIÓN)
OPENAI_API_KEY=your_openai_key_here

# Server Configuration
SERVER_URL=http://$SERVER_IP:$APP_PORT
EOF
    show_success "Archivo .env creado"
    
    show_progress 3 6 "Construyendo aplicación..."
    npm run build &>/dev/null
    show_success "Aplicación construida"
    
    show_progress 4 6 "Configurando base de datos..."
    npm run db:push &>/dev/null
    show_success "Esquema de base de datos configurado"
    
    show_progress 5 6 "Creando directorio de logs..."
    mkdir -p logs
    show_success "Directorio de logs creado"
    
    show_progress 6 6 "Aplicación completada"
    sleep 1
    echo
}

# Configure nginx
configure_nginx() {
    if [[ "$INSTALL_NGINX" != "true" ]]; then
        return
    fi
    
    show_step 6 "Configuración de Nginx"
    
    show_progress 1 3 "Creando configuración de Nginx..."
    
    sudo tee /etc/nginx/sites-available/whatsapp-crm > /dev/null <<EOF
server {
    listen 80;
    server_name ${DOMAIN:-$SERVER_IP};

    location / {
        proxy_pass http://localhost:$APP_PORT;
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
        proxy_pass http://localhost:$APP_PORT;
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
    show_success "Configuración de Nginx creada"
    
    show_progress 2 3 "Activando sitio..."
    sudo ln -sf /etc/nginx/sites-available/whatsapp-crm /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    show_success "Sitio activado"
    
    show_progress 3 3 "Reiniciando Nginx..."
    sudo nginx -t &>/dev/null && sudo systemctl restart nginx
    show_success "Nginx configurado y reiniciado"
    
    if [[ "$CONFIGURE_SSL" == "true" ]]; then
        show_info "Configurando SSL con Let's Encrypt..."
        sudo apt install -y -qq certbot python3-certbot-nginx
        sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
        show_success "SSL configurado para $DOMAIN"
    fi
    
    echo
}

# Start application
start_application() {
    show_step 7 "Iniciando la Aplicación"
    
    show_progress 1 4 "Iniciando con PM2..."
    pm2 start ecosystem.config.js &>/dev/null
    show_success "Aplicación iniciada"
    
    show_progress 2 4 "Configurando inicio automático..."
    pm2 save &>/dev/null
    pm2 startup &>/dev/null || true
    show_success "Inicio automático configurado"
    
    show_progress 3 4 "Verificando estado..."
    sleep 3
    if pm2 list | grep -q "online"; then
        show_success "Aplicación ejecutándose correctamente"
    else
        show_warning "La aplicación puede no estar ejecutándose correctamente"
    fi
    
    show_progress 4 4 "Aplicación completada"
    sleep 1
    echo
}

# Show completion
show_completion() {
    show_step 8 "¡Instalación Completada!"
    
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ¡INSTALACIÓN EXITOSA!                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    
    echo -e "\n${CYAN}🎉 Tu sistema WhatsApp CRM está listo para usar${NC}"
    
    echo -e "\n${YELLOW}INFORMACIÓN DE ACCESO:${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        if [[ "$CONFIGURE_SSL" == "true" ]]; then
            echo -e "🌐 URL Principal: ${GREEN}https://$DOMAIN${NC}"
        else
            echo -e "🌐 URL Principal: ${GREEN}http://$SERVER_IP${NC}"
        fi
        echo -e "🌐 URL Directa: ${GREEN}http://$SERVER_IP:$APP_PORT${NC}"
    else
        echo -e "🌐 URL de Acceso: ${GREEN}http://$SERVER_IP:$APP_PORT${NC}"
    fi
    
    echo -e "\n${YELLOW}INFORMACIÓN DE BASE DE DATOS:${NC}"
    echo -e "📊 Base de datos: $DB_NAME"
    echo -e "👤 Usuario: $DB_USER"
    echo -e "🔑 Contraseña: $DB_PASSWORD"
    
    echo -e "\n${YELLOW}PRÓXIMOS PASOS:${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "1. ${CYAN}Configurar tu clave API de OpenAI:${NC}"
    echo -e "   nano .env"
    echo -e "   (Busca OPENAI_API_KEY y reemplaza 'your_openai_key_here')"
    echo
    echo -e "2. ${CYAN}Reiniciar la aplicación después de configurar las APIs:${NC}"
    echo -e "   pm2 restart whatsapp-crm"
    echo
    echo -e "3. ${CYAN}Monitorear la aplicación:${NC}"
    echo -e "   pm2 logs whatsapp-crm"
    echo -e "   pm2 status"
    echo
    echo -e "4. ${CYAN}Acceder a tu sistema y configurar WhatsApp${NC}"
    
    echo -e "\n${YELLOW}COMANDOS ÚTILES:${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Ver logs: ${GREEN}pm2 logs whatsapp-crm${NC}"
    echo -e "Reiniciar: ${GREEN}pm2 restart whatsapp-crm${NC}"
    echo -e "Detener: ${GREEN}pm2 stop whatsapp-crm${NC}"
    echo -e "Estado: ${GREEN}pm2 status${NC}"
    echo -e "Monitor: ${GREEN}pm2 monit${NC}"
    
    if [[ "$INSTALL_NGINX" == "true" ]]; then
        echo -e "Reiniciar Nginx: ${GREEN}sudo systemctl restart nginx${NC}"
        echo -e "Estado Nginx: ${GREEN}sudo systemctl status nginx${NC}"
    fi
    
    echo -e "\n${GREEN}¡Gracias por usar WhatsApp CRM System!${NC}"
    echo -e "${BLUE}Para soporte técnico, consulta la documentación en GitHub.${NC}"
}

# Main installation flow
main() {
    check_root
    show_welcome
    system_check
    get_configuration
    install_dependencies
    setup_database
    install_application
    configure_nginx
    start_application
    show_completion
}

# Run main function
main "$@"