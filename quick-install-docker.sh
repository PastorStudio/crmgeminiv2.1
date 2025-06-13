#!/bin/bash

# CRM WhatsApp AI - Instalación Rápida con Docker
# Versión: 1.0

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    log "Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    log "Instalando Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Solicitar información
read -p "Ingresa tu dominio (ej: micrm.com): " DOMAIN
read -p "Ingresa la URL de tu repositorio Git: " REPO_URL
read -s -p "Contraseña para la base de datos: " DB_PASSWORD
echo

# Clonar repositorio
log "Clonando repositorio..."
git clone $REPO_URL crm-whatsapp-ai
cd crm-whatsapp-ai

# Crear archivo .env
log "Configurando variables de entorno..."
cat > .env << EOF
# Base de datos
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://crm_user:$DB_PASSWORD@postgres:5432/crm_whatsapp_ai

# JWT
JWT_SECRET=crm-whatsapp-ai-secure-token-$(date +%s)-docker

# URLs
FRONTEND_URL=https://$DOMAIN
BACKEND_URL=https://$DOMAIN

# APIs (configura después de la instalación)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
QWEN3_API_KEY=your_qwen3_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
EOF

# Crear configuración de Nginx para Docker
log "Configurando Nginx..."
cat > nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:5000;
    }

    server {
        listen 80;
        server_name $DOMAIN www.$DOMAIN;
        
        client_max_body_size 50M;

        location /api/ {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        location /ws {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host \$host;
        }

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
        }
    }
}
EOF

# Iniciar servicios
log "Iniciando servicios con Docker..."
docker-compose -f docker-compose.production.yml up -d

# Esperar a que los servicios estén listos
log "Esperando a que los servicios estén listos..."
sleep 30

# Ejecutar migraciones
log "Ejecutando migraciones de base de datos..."
docker-compose -f docker-compose.production.yml exec app npm run db:push || warn "Error en migraciones"

log "¡Instalación completada!"
echo
echo "=== INFORMACIÓN DEL SISTEMA ==="
echo "URL: http://$DOMAIN"
echo "Base de datos: PostgreSQL en contenedor"
echo "Cache: Redis en contenedor"
echo
echo "=== COMANDOS ÚTILES ==="
echo "Ver logs: docker-compose -f docker-compose.production.yml logs -f"
echo "Reiniciar: docker-compose -f docker-compose.production.yml restart"
echo "Detener: docker-compose -f docker-compose.production.yml down"
echo "Actualizar: git pull && docker-compose -f docker-compose.production.yml up -d --build"
echo
echo "IMPORTANTE: Configura tus API keys en el archivo .env y reinicia los contenedores"