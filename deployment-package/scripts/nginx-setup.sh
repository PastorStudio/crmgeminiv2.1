#!/bin/bash

# Script para configurar Nginx como proxy reverso
# Sistema CRM WhatsApp AI

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

show_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

show_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables
DOMAIN="localhost"
PROJECT_DIR="/var/www/crm-whatsapp-ai"

# Solicitar dominio al usuario
read -p "Ingresa tu dominio (o presiona Enter para localhost): " user_domain
if [[ -n "$user_domain" ]]; then
    DOMAIN="$user_domain"
fi

# Instalar Nginx
install_nginx() {
    show_message "Instalando Nginx..."
    sudo apt update
    sudo apt install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    show_message "Nginx instalado y configurado"
}

# Crear configuración de Nginx
create_nginx_config() {
    show_message "Creando configuración de Nginx para $DOMAIN..."
    
    sudo tee /etc/nginx/sites-available/crm-whatsapp-ai > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Logs
    access_log /var/log/nginx/crm-whatsapp-ai.access.log;
    error_log /var/log/nginx/crm-whatsapp-ai.error.log;
}
EOF

    # Activar el sitio
    sudo ln -sf /etc/nginx/sites-available/crm-whatsapp-ai /etc/nginx/sites-enabled/
    
    # Remover configuración por defecto
    sudo rm -f /etc/nginx/sites-enabled/default
    
    show_message "Configuración de Nginx creada"
}

# Configurar SSL con Let's Encrypt
setup_ssl() {
    if [[ "$DOMAIN" == "localhost" ]]; then
        show_warning "SSL no se configurará para localhost"
        return
    fi
    
    read -p "¿Deseas configurar SSL con Let's Encrypt? (y/N): " ssl_confirm
    if [[ ! $ssl_confirm =~ ^[Yy]$ ]]; then
        return
    fi
    
    show_message "Instalando Certbot..."
    sudo apt install -y certbot python3-certbot-nginx
    
    show_message "Obteniendo certificado SSL para $DOMAIN..."
    sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN"
    
    show_message "SSL configurado exitosamente"
}

# Actualizar configuración del frontend
update_frontend_config() {
    show_message "Actualizando configuración del frontend..."
    
    cd "$PROJECT_DIR/frontend"
    
    if [[ "$DOMAIN" == "localhost" ]]; then
        FRONTEND_URL="http://localhost"
        WS_URL="ws://localhost"
    else
        FRONTEND_URL="https://$DOMAIN"
        WS_URL="wss://$DOMAIN"
    fi
    
    # Actualizar .env del frontend
    sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$FRONTEND_URL|" .env
    sed -i "s|VITE_WS_URL=.*|VITE_WS_URL=$WS_URL|" .env
    
    show_message "Configuración del frontend actualizada"
}

# Función principal
main() {
    show_message "=== CONFIGURACIÓN DE NGINX ==="
    
    # Verificar si Nginx está instalado
    if ! command -v nginx &> /dev/null; then
        install_nginx
    else
        show_message "Nginx ya está instalado"
    fi
    
    # Crear configuración
    create_nginx_config
    
    # Probar configuración
    show_message "Probando configuración de Nginx..."
    sudo nginx -t
    
    # Recargar Nginx
    sudo systemctl reload nginx
    
    # Configurar SSL si es necesario
    setup_ssl
    
    # Actualizar configuración del frontend
    update_frontend_config
    
    # Recompilar frontend
    show_message "Recompilando frontend..."
    npm run build
    
    # Reiniciar servicios
    show_message "Reiniciando servicios..."
    cd "$PROJECT_DIR"
    pm2 restart all
    
    show_message "=== CONFIGURACIÓN COMPLETADA ==="
    echo ""
    echo "🌐 Tu sitio está disponible en:"
    if [[ "$DOMAIN" == "localhost" ]]; then
        echo "  http://localhost"
    else
        echo "  https://$DOMAIN"
    fi
    echo ""
    echo "📊 Logs de Nginx:"
    echo "  Acceso: /var/log/nginx/crm-whatsapp-ai.access.log"
    echo "  Errores: /var/log/nginx/crm-whatsapp-ai.error.log"
}

# Ejecutar
main "$@"