# Guía de Instalación Detallada

Esta guía te proporcionará los pasos detallados para instalar el CRM en un servidor VPS con tu propio dominio.

## Requisitos previos

- Un servidor VPS con al menos 2GB de RAM (recomendado 4GB)
- Ubuntu 20.04 LTS o superior
- Un nombre de dominio configurado para apuntar a la IP de tu VPS
- Acceso SSH como usuario con privilegios sudo

## 1. Preparación del servidor

Actualiza el sistema e instala las dependencias necesarias:

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias básicas
sudo apt install -y git curl build-essential nginx

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Instalar dependencias para Puppeteer (necesario para WhatsApp Web)
sudo apt install -y libgbm-dev gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
```

## 2. Configurar PostgreSQL

```bash
# Acceder a PostgreSQL
sudo -u postgres psql

# Crear usuario y base de datos
CREATE USER tu_usuario WITH PASSWORD 'tu_contraseña';
CREATE DATABASE crm_db OWNER tu_usuario;
\q

# Configurar acceso en pg_hba.conf si es necesario
sudo nano /etc/postgresql/13/main/pg_hba.conf
# Añadir línea: host crm_db tu_usuario 127.0.0.1/32 md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

## 3. Clonar el repositorio

```bash
# Crear directorio para la aplicación
mkdir -p /var/www/tu-dominio
cd /var/www/tu-dominio

# Clonar el repositorio
git clone https://github.com/tu-usuario/crm-whatsapp-ai.git .
```

## 4. Configurar variables de entorno

Crea un archivo `.env` con las variables de entorno necesarias:

```bash
cat > .env << EOF
# Database
DATABASE_URL=postgresql://tu_usuario:tu_contraseña@localhost:5432/crm_db
PGDATABASE=crm_db
PGHOST=localhost
PGUSER=tu_usuario
PGPASSWORD=tu_contraseña
PGPORT=5432

# API Keys
OPENAI_API_KEY=tu_clave_openai
GEMINI_API_KEY=tu_clave_gemini_servidor

# Configuración servidor
PORT=5000
NODE_ENV=production
EOF
```

## 5. Instalar dependencias y compilar

```bash
# Instalar PM2 globalmente
sudo npm install -y pm2 -g

# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install

# Compilar frontend
npm run build
```

## 6. Configurar Nginx

Crea una configuración para tu dominio:

```bash
sudo nano /etc/nginx/sites-available/tu-dominio.conf
```

Pega el siguiente contenido (reemplaza `tu-dominio.com` con tu dominio real):

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name tu-dominio.com www.tu-dominio.com;
    
    # Rutas SSL (se actualizarán con Let's Encrypt)
    ssl_certificate /etc/nginx/ssl/dummy.crt;
    ssl_certificate_key /etc/nginx/ssl/dummy.key;
    
    root /var/www/tu-dominio/frontend/build;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }
}
```

Activa la configuración:

```bash
# Crear certificado dummy temporal
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/nginx/ssl/dummy.key -out /etc/nginx/ssl/dummy.crt -subj "/CN=tu-dominio.com"

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/tu-dominio.conf /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

## 7. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

## 8. Iniciar la aplicación

```bash
# Crear un archivo ecosystem.config.js para PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'crm-backend',
    script: 'backend/server/index.ts',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
}
EOF

# Iniciar con PM2
pm2 start ecosystem.config.js

# Configurar inicio automático
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $(whoami) --hp $(eval echo ~$(whoami))
pm2 save
```

## 9. Configurar respaldos automáticos

```bash
# Crear script de respaldo
cat > /usr/local/bin/backup-crm-db.sh << EOF
#!/bin/bash
BACKUP_DIR="/var/backups/crm"
TIMESTAMP=\$(date +"%Y%m%d_%H%M%S")
DB_NAME="crm_db"
DB_USER="tu_usuario"

mkdir -p \$BACKUP_DIR
pg_dump -U \$DB_USER \$DB_NAME | gzip > "\$BACKUP_DIR/db_backup_\$TIMESTAMP.sql.gz"

# Mantener solo los últimos 7 días
find \$BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-crm-db.sh

# Configurar cron job
echo "0 2 * * * /usr/local/bin/backup-crm-db.sh" | sudo tee -a /var/spool/cron/crontabs/root > /dev/null
```

## 10. Obtener una clave API adecuada para Gemini

Para resolver el problema de la clave de cliente y obtener una clave de servidor para Gemini:

1. Visita la [Consola de Google Cloud](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Activa la facturación (requerido para usar Vertex AI API)
4. Habilita la API de Vertex AI
5. Crea una cuenta de servicio en "IAM & Admin > Service Accounts"
6. Asigna el rol "Vertex AI User" a esta cuenta
7. Genera una clave JSON para esta cuenta de servicio
8. Descarga el archivo JSON

Luego configura la variable de entorno en tu servidor:

```bash
# Añade estas líneas a tu archivo .env
GOOGLE_APPLICATION_CREDENTIALS=/ruta/completa/al/archivo-credenciales.json
GEMINI_API_KEY=vertex_ai:tu-project-id
GEMINI_USE_VERTEX=true
```

## Mantenimiento

- **Ver logs**: `pm2 logs`
- **Reiniciar aplicación**: `pm2 restart crm-backend`
- **Actualizar repositorio**: 
  ```bash
  cd /var/www/tu-dominio
  git pull
  cd frontend && npm ci && npm run build
  cd ../backend && npm ci
  pm2 restart crm-backend
  ```

## Solución de problemas

Si encuentras problemas durante la instalación:

1. **Error en la conexión a WhatsApp Web**: Asegúrate de que todas las dependencias para Puppeteer están instaladas correctamente.

2. **Error en la conexión a la base de datos**: Verifica las credenciales en tu archivo `.env` y asegúrate de que PostgreSQL está funcionando.

3. **Error 404 en las APIs de IA**: Confirma que tienes las claves API correctas configuradas. Si estás usando una clave de Gemini que comienza con "AIza", es una clave de cliente y necesitarás obtener una clave de servidor siguiendo los pasos de la sección 10.

4. **El frontend no carga**: Verifica la configuración de Nginx y asegúrate de que los archivos están correctamente compilados y ubicados.

Para más detalles, consulta la [guía de solución de problemas](docs/TROUBLESHOOTING.md).