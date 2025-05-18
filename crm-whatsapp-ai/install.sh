#!/bin/bash

# Colores para salida
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Iniciando instalación del CRM con WhatsApp e IA...${NC}"

# Verificar si estamos en Ubuntu/Debian
if [ -f /etc/debian_version ]; then
    echo -e "${GREEN}Actualizando sistema...${NC}"
    sudo apt update && sudo apt upgrade -y

    echo -e "${GREEN}Instalando dependencias del sistema...${NC}"
    sudo apt install -y git curl build-essential nginx

    echo -e "${GREEN}Instalando Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs

    echo -e "${GREEN}Instalando PostgreSQL...${NC}"
    sudo apt install -y postgresql postgresql-contrib

    echo -e "${GREEN}Instalando dependencias para Puppeteer (WhatsApp Web)...${NC}"
    sudo apt install -y libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
else
    echo -e "${RED}Este script está diseñado para Ubuntu/Debian.${NC}"
    echo -e "${RED}Por favor, instala manualmente las dependencias para tu sistema.${NC}"
    exit 1
fi

# Instalación de PM2
echo -e "${GREEN}Instalando PM2 para gestión de procesos...${NC}"
sudo npm install -y pm2 -g

# Configuración de la base de datos
echo -e "${GREEN}Configurando base de datos PostgreSQL...${NC}"
echo -e "${GREEN}Introduce el nombre de usuario para PostgreSQL:${NC}"
read DB_USER
echo -e "${GREEN}Introduce la contraseña para PostgreSQL:${NC}"
read -s DB_PASSWORD
echo -e "${GREEN}Introduce el nombre de la base de datos:${NC}"
read DB_NAME

# Crear usuario y base de datos
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Crear archivo .env para backend
echo -e "${GREEN}Creando archivo .env para configuración...${NC}"
cat > .env << EOF
# Database
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
PGDATABASE=$DB_NAME
PGHOST=localhost
PGUSER=$DB_USER
PGPASSWORD=$DB_PASSWORD
PGPORT=5432

# API Keys
OPENAI_API_KEY=tu_clave_openai
GEMINI_API_KEY=tu_clave_gemini_servidor

# Configuración servidor
PORT=5000
NODE_ENV=production
EOF

# Instalar dependencias del proyecto
echo -e "${GREEN}Instalando dependencias del backend...${NC}"
cd backend
npm install

echo -e "${GREEN}Instalando dependencias del frontend...${NC}"
cd ../frontend
npm install

# Compilar frontend
echo -e "${GREEN}Compilando frontend...${NC}"
npm run build

# Configurar Nginx
echo -e "${GREEN}Introduce tu nombre de dominio (sin www):${NC}"
read DOMAIN

echo -e "${GREEN}Configurando Nginx...${NC}"
sudo bash -c "cat > /etc/nginx/sites-available/$DOMAIN << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN www.$DOMAIN;
    
    # Estas rutas se actualizarán con Let's Encrypt
    ssl_certificate /etc/nginx/ssl/dummy.crt;
    ssl_certificate_key /etc/nginx/ssl/dummy.key;
    
    root /var/www/$DOMAIN/frontend/build;
    
    location / {
        try_files \$uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }
}
EOF"

# Crear directorio y certificado dummy para Nginx
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/dummy.key -out /etc/nginx/ssl/dummy.crt -subj "/CN=$DOMAIN"

# Habilitar sitio y reiniciar Nginx
sudo ln -s /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Script de inicio
echo -e "${GREEN}Creando script de inicio...${NC}"
cat > start.sh << EOF
#!/bin/bash
cd backend
pm2 start server/index.ts --name crm-backend -- NODE_ENV=production
echo "CRM iniciado con PM2. Usa 'pm2 logs' para ver los logs."
EOF

chmod +x start.sh

# Configurar Let's Encrypt
echo -e "${GREEN}¿Deseas configurar SSL con Let's Encrypt? (y/n)${NC}"
read SSL_CHOICE

if [ "$SSL_CHOICE" = "y" ]; then
    echo -e "${GREEN}Instalando Certbot...${NC}"
    sudo apt install -y certbot python3-certbot-nginx
    
    echo -e "${GREEN}Obteniendo certificado SSL...${NC}"
    sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN
    
    echo -e "${GREEN}Configurando renovación automática...${NC}"
    sudo certbot renew --dry-run
fi

# Script de respaldo
echo -e "${GREEN}Creando script de respaldo diario...${NC}"
cat > backup.sh << EOF
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
DB_NAME="$DB_NAME"
DB_USER="$DB_USER"

mkdir -p \$BACKUP_DIR
pg_dump -U \$DB_USER \$DB_NAME | gzip > "\$BACKUP_DIR/db_backup_\$TIMESTAMP.sql.gz"

# Mantener solo los últimos 7 días
find \$BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x backup.sh
sudo mv backup.sh /usr/local/bin/

# Configurar respaldo diario con cron
echo "0 2 * * * /usr/local/bin/backup.sh" | sudo tee -a /var/spool/cron/crontabs/root > /dev/null

echo -e "${GREEN}¡Instalación completa!${NC}"
echo -e "${GREEN}Recomendaciones finales:${NC}"
echo -e "1. Edita el archivo .env con tus claves API reales"
echo -e "2. Inicia la aplicación con ./start.sh"
echo -e "3. Configura tu dominio DNS para que apunte a este servidor"
echo -e "4. Si encuentras problemas, revisa los logs con 'pm2 logs'"