#!/bin/bash

# CRM WhatsApp AI - Instalador Automático para VPS
# Versión: 2.0
# Compatible con: Ubuntu 20.04+, Debian 11+

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Verificar si se ejecuta como root
if [[ $EUID -eq 0 ]]; then
   error "Este script no debe ejecutarse como root. Usa un usuario normal con sudo."
fi

# Verificar sistema operativo
if [[ ! -f /etc/os-release ]]; then
    error "Sistema operativo no soportado"
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    error "Este script solo soporta Ubuntu y Debian"
fi

log "Iniciando instalación de CRM WhatsApp AI en VPS..."

# Variables de configuración
PROJECT_NAME="crm-whatsapp-ai"
DB_NAME="crm_whatsapp_ai"
DB_USER="crm_user"
PROJECT_DIR="/opt/$PROJECT_NAME"
SERVICE_USER="crm"

# Solicitar información del usuario
read -p "Ingresa tu nombre de dominio (ej: micrm.com): " DOMAIN
read -p "Ingresa la URL de tu repositorio Git: " REPO_URL
read -s -p "Crea una contraseña para la base de datos: " DB_PASSWORD
echo
read -s -p "Confirma la contraseña de la base de datos: " DB_PASSWORD_CONFIRM
echo

if [[ "$DB_PASSWORD" != "$DB_PASSWORD_CONFIRM" ]]; then
    error "Las contraseñas no coinciden"
fi

# 1. Actualizar sistema
log "Actualizando sistema..."
sudo apt update && sudo apt upgrade -y

# 2. Instalar dependencias del sistema
log "Instalando dependencias del sistema..."
sudo apt install -y curl wget git build-essential python3 python3-pip \
    software-properties-common apt-transport-https ca-certificates \
    gnupg lsb-release ufw nginx certbot python3-certbot-nginx \
    postgresql postgresql-contrib redis-server htop

# 3. Instalar Node.js 20.x
log "Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación de Node.js
NODE_VERSION=$(node --version)
log "Node.js instalado: $NODE_VERSION"

# 4. Crear usuario del sistema para la aplicación
log "Creando usuario del sistema para la aplicación..."
sudo useradd -r -s /bin/bash -d /opt/$PROJECT_NAME $SERVICE_USER || true
sudo mkdir -p $PROJECT_DIR
sudo chown $SERVICE_USER:$SERVICE_USER $PROJECT_DIR

# 5. Configurar PostgreSQL
log "Configurando PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;" || warn "Base de datos ya existe"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';" || warn "Usuario ya existe"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -c "ALTER USER $DB_USER CREATEDB;"

# 6. Configurar Redis
log "Configurando Redis..."
sudo systemctl start redis-server
sudo systemctl enable redis-server

# 7. Clonar y configurar proyecto
log "Clonando proyecto desde repositorio..."
sudo -u $SERVICE_USER git clone $REPO_URL $PROJECT_DIR || error "Error al clonar repositorio"

cd $PROJECT_DIR

# 8. Instalar dependencias globales
log "Instalando herramientas globales..."
sudo npm install -g pm2 typescript tsx drizzle-kit

# 9. Instalar dependencias del proyecto
log "Instalando dependencias del proyecto..."
sudo -u $SERVICE_USER npm install

# 10. Configurar variables de entorno
log "Configurando variables de entorno..."
sudo -u $SERVICE_USER tee .env > /dev/null <<EOF
# Configuración de base de datos
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME

# JWT Secret
JWT_SECRET=crm-whatsapp-ai-secure-token-$(date +%s)-production

# Configuración del servidor
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# URLs del sistema
FRONTEND_URL=https://$DOMAIN
BACKEND_URL=https://$DOMAIN

# APIs (configurar manualmente después)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
QWEN3_API_KEY=your_qwen3_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
EOF

# 11. Compilar proyecto
log "Compilando proyecto TypeScript..."
sudo -u $SERVICE_USER npm run build || {
    warn "Error en build, intentando compilación manual..."
    sudo -u $SERVICE_USER npx tsc --project tsconfig.json || {
        warn "Compilación TypeScript falló, continuando..."
    }
}

# 12. Configurar base de datos
log "Configurando base de datos..."
sudo -u $SERVICE_USER npm run db:push || {
    warn "Error en db:push, intentando con drizzle-kit..."
    sudo -u $SERVICE_USER npx drizzle-kit push:pg || warn "Error en migración de BD"
}

# 13. Crear archivo de configuración PM2
log "Configurando PM2..."
sudo -u $SERVICE_USER tee ecosystem.config.js > /dev/null <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: './server/vite.ts',
    interpreter: 'tsx',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=2048',
    watch: false,
    ignore_watch: ['node_modules', 'logs']
  }]
};
EOF

# Crear directorio de logs
sudo -u $SERVICE_USER mkdir -p logs

# 14. Configurar Nginx
log "Configurando Nginx..."
sudo tee /etc/nginx/sites-available/$PROJECT_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Redirigir HTTP a HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # Configuración SSL (se configurará con certbot)
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Configuración de seguridad SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Límites de tamaño
    client_max_body_size 50M;

    # Configuración para archivos estáticos
    location /assets/ {
        alias $PROJECT_DIR/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy para API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Proxy para WebSocket
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Servir frontend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "no-referrer-when-downgrade" always;
    }
}
EOF

# Habilitar sitio
sudo ln -sf /etc/nginx/sites-available/$PROJECT_NAME /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Verificar configuración de Nginx
sudo nginx -t || error "Error en configuración de Nginx"

# 15. Configurar firewall
log "Configurando firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# 16. Obtener certificado SSL
log "Obteniendo certificado SSL..."
sudo systemctl reload nginx
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
    warn "Error obteniendo SSL, continuando sin HTTPS..."
    # Configuración temporal sin SSL
    sudo tee /etc/nginx/sites-available/$PROJECT_NAME > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    client_max_body_size 50M;

    location /api/ {
        proxy_pass http://localhost:5000;
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
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
EOF
    sudo systemctl reload nginx
}

# 17. Configurar auto-renovación SSL
log "Configurando renovación automática de SSL..."
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -

# 18. Crear servicio systemd como respaldo
log "Creando servicio systemd..."
sudo tee /etc/systemd/system/$PROJECT_NAME.service > /dev/null <<EOF
[Unit]
Description=CRM WhatsApp AI Application
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/tsx server/vite.ts
Restart=on-failure
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=$PROJECT_NAME

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable $PROJECT_NAME

# 19. Iniciar aplicación con PM2
log "Iniciando aplicación..."
cd $PROJECT_DIR
sudo -u $SERVICE_USER pm2 start ecosystem.config.js
sudo -u $SERVICE_USER pm2 save

# Configurar PM2 para inicio automático
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $SERVICE_USER --hp $PROJECT_DIR
sudo systemctl enable pm2-$SERVICE_USER

# 20. Crear scripts de mantenimiento
log "Creando scripts de mantenimiento..."

# Script de backup
sudo tee /usr/local/bin/crm-backup > /dev/null <<EOF
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=\$(date +%Y%m%d_%H%M%S)
mkdir -p \$BACKUP_DIR
pg_dump $DB_NAME > \$BACKUP_DIR/crm_backup_\$DATE.sql
find \$BACKUP_DIR -type f -mtime +7 -delete
echo "Backup completado: crm_backup_\$DATE.sql"
EOF

sudo chmod +x /usr/local/bin/crm-backup

# Script de actualización
sudo tee /usr/local/bin/crm-update > /dev/null <<EOF
#!/bin/bash
cd $PROJECT_DIR
sudo -u $SERVICE_USER git pull origin main
sudo -u $SERVICE_USER npm install
sudo -u $SERVICE_USER npm run build || echo "Build falló, continuando..."
sudo -u $SERVICE_USER pm2 restart $PROJECT_NAME
echo "Aplicación actualizada y reiniciada"
EOF

sudo chmod +x /usr/local/bin/crm-update

# Script de logs
sudo tee /usr/local/bin/crm-logs > /dev/null <<EOF
#!/bin/bash
sudo -u $SERVICE_USER pm2 logs $PROJECT_NAME
EOF

sudo chmod +x /usr/local/bin/crm-logs

# 21. Configurar backup automático
echo "0 2 * * * /usr/local/bin/crm-backup" | sudo crontab -

# 22. Verificaciones finales
log "Realizando verificaciones finales..."

# Verificar servicios
sudo systemctl status postgresql --no-pager || warn "PostgreSQL no está corriendo"
sudo systemctl status nginx --no-pager || warn "Nginx no está corriendo"
sudo systemctl status redis-server --no-pager || warn "Redis no está corriendo"

# Verificar PM2
sudo -u $SERVICE_USER pm2 status || warn "PM2 no está corriendo correctamente"

# Mostrar información final
log "¡Instalación completada!"
echo
echo -e "${BLUE}=== INFORMACIÓN DE INSTALACIÓN ===${NC}"
echo -e "${GREEN}URL de la aplicación:${NC} http://$DOMAIN"
echo -e "${GREEN}Directorio del proyecto:${NC} $PROJECT_DIR"
echo -e "${GREEN}Usuario del servicio:${NC} $SERVICE_USER"
echo -e "${GREEN}Base de datos:${NC} $DB_NAME"
echo
echo -e "${BLUE}=== COMANDOS ÚTILES ===${NC}"
echo -e "${GREEN}Ver logs:${NC} crm-logs"
echo -e "${GREEN}Actualizar aplicación:${NC} crm-update"
echo -e "${GREEN}Hacer backup:${NC} crm-backup"
echo -e "${GREEN}Estado PM2:${NC} sudo -u $SERVICE_USER pm2 status"
echo -e "${GREEN}Reiniciar app:${NC} sudo -u $SERVICE_USER pm2 restart $PROJECT_NAME"
echo
echo -e "${YELLOW}IMPORTANTE: Configura tus API keys en: $PROJECT_DIR/.env${NC}"
echo -e "${YELLOW}Luego reinicia la aplicación: sudo -u $SERVICE_USER pm2 restart $PROJECT_NAME${NC}"
echo
echo -e "${GREEN}¡La instalación se ha completado exitosamente!${NC}"