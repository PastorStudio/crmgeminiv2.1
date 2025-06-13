# Guía de Despliegue en VPS - CRM WhatsApp AI

## Pre-requisitos del Sistema

### Versiones mínimas requeridas:
- **Node.js**: 18.x o superior
- **PostgreSQL**: 14.x o superior  
- **Redis**: 6.x o superior (opcional, recomendado)
- **RAM**: Mínimo 2GB, recomendado 4GB
- **Storage**: Mínimo 10GB disponibles

## Instalación Paso a Paso

### 1. Preparar el servidor (Ubuntu/Debian)

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar dependencias del sistema
sudo apt install -y curl wget git build-essential python3 python3-pip

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # Debe ser v18+ 
npm --version   # Debe ser v8+
```

### 2. Instalar PostgreSQL

```bash
# Instalar PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Configurar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres psql
```

```sql
-- En la consola de PostgreSQL:
CREATE DATABASE crm_whatsapp_ai;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE crm_whatsapp_ai TO crm_user;
ALTER USER crm_user CREATEDB;
\q
```

### 3. Clonar y configurar el proyecto

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/tu-repositorio.git
cd tu-repositorio

# Instalar dependencias globales necesarias
sudo npm install -g pm2 typescript tsx

# Instalar dependencias del proyecto
npm install

# Instalar dependencias adicionales para VPS
npm install --production=false
```

### 4. Configurar variables de entorno

```bash
# Crear archivo .env
cp .env.example .env
```

```env
# Configuración de base de datos
DATABASE_URL=postgresql://crm_user:tu_password_seguro@localhost:5432/crm_whatsapp_ai

# JWT Secret
JWT_SECRET=crm-whatsapp-ai-secure-token-2025-production-vps

# APIs (configura tus claves)
GEMINI_API_KEY=tu_clave_gemini
OPENAI_API_KEY=tu_clave_openai
QWEN3_API_KEY=tu_clave_qwen3
DEEPSEEK_API_KEY=tu_clave_deepseek

# Configuración del servidor
NODE_ENV=production
PORT=5000
HOST=0.0.0.0

# URLs del sistema
FRONTEND_URL=http://tu-dominio.com
BACKEND_URL=http://tu-dominio.com:5000
```

### 5. Compilar el proyecto

```bash
# Compilar TypeScript
npm run build

# Si no existe el comando build, crear script de compilación
npx tsc --project tsconfig.json

# Instalar solo dependencias de producción
npm ci --only=production
```

### 6. Configurar base de datos

```bash
# Ejecutar migraciones
npm run db:push

# Si no existe, usar drizzle directamente
npx drizzle-kit push:pg

# Poblar datos iniciales
npm run db:seed
```

### 7. Configurar PM2 para producción

```bash
# Crear archivo ecosystem.config.js si no existe
```

```javascript
module.exports = {
  apps: [{
    name: 'crm-whatsapp-ai',
    script: 'npm',
    args: 'start',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max_old_space_size=2048'
  }]
};
```

```bash
# Crear directorio de logs
mkdir -p logs

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 8. Configurar Nginx (Proxy Reverso)

```bash
# Instalar Nginx
sudo apt install -y nginx

# Crear configuración
sudo nano /etc/nginx/sites-available/crm-whatsapp-ai
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Configuración para archivos estáticos
    location /assets/ {
        alias /ruta/a/tu/proyecto/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy para API
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Proxy para WebSocket
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Servir frontend
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Habilitar sitio
sudo ln -s /etc/nginx/sites-available/crm-whatsapp-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Configurar renovación automática
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

### 10. Configurar Firewall

```bash
# Configurar UFW
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## Solución de Problemas Comunes

### Error de compilación TypeScript

```bash
# Limpiar cache y reinstalar
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Compilar con más memoria
node --max_old_space_size=4096 ./node_modules/.bin/tsc
```

### Error de permisos en archivos

```bash
# Configurar permisos correctos
sudo chown -R $USER:$USER /ruta/a/tu/proyecto
chmod -R 755 /ruta/a/tu/proyecto
```

### Error de conexión a PostgreSQL

```bash
# Verificar servicio
sudo systemctl status postgresql

# Editar configuración si es necesario
sudo nano /etc/postgresql/14/main/postgresql.conf
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

### Problemas con módulos nativos

```bash
# Reconstruir módulos nativos
npm rebuild

# Si persiste el error, instalar dependencias nativas
sudo apt install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

## Scripts Útiles de Mantenimiento

### Backup automático

```bash
#!/bin/bash
# backup.sh
DB_NAME="crm_whatsapp_ai"
BACKUP_DIR="/home/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
pg_dump $DB_NAME > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -type f -mtime +7 -delete
```

### Monitoreo del sistema

```bash
# Ver logs en tiempo real
pm2 logs crm-whatsapp-ai

# Ver estado de la aplicación
pm2 status

# Reiniciar aplicación
pm2 restart crm-whatsapp-ai

# Ver métricas del sistema
pm2 monit
```

## Verificación Final

1. **Acceso web**: `http://tu-dominio.com`
2. **API funcionando**: `http://tu-dominio.com/api/health`
3. **WebSocket activo**: Verificar conexiones en tiempo real
4. **Base de datos**: Verificar datos cargados correctamente

## Comandos de Troubleshooting

```bash
# Verificar puertos en uso
sudo netstat -tlnp

# Ver logs del sistema
sudo journalctl -f

# Verificar memoria y CPU
htop

# Test de conectividad a BD
psql -h localhost -U crm_user -d crm_whatsapp_ai
```

Esta guía cubre todos los aspectos críticos del despliegue en VPS. ¿En qué paso específico estás teniendo problemas?