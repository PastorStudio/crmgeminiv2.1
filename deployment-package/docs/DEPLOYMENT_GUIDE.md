# 🚀 Guía de Despliegue - Sistema CRM WhatsApp AI

## 📋 Descripción del Sistema

Sistema CRM empresarial de WhatsApp con IA integrada que proporciona:
- Respuestas automáticas inteligentes multilenguaje
- Integración con múltiples proveedores de IA (Gemini, OpenAI, Qwen3)
- Gestión de múltiples cuentas de WhatsApp
- Monitoreo en tiempo real y análisis de mensajes
- Interfaz web moderna con React y TypeScript

---

## 🔧 Requisitos del Servidor

### Hardware Mínimo
- **CPU**: 2 núcleos (4 núcleos recomendados)
- **RAM**: 4GB (8GB recomendados)
- **Almacenamiento**: 20GB SSD
- **Red**: Conexión estable a Internet

### Software Requerido
- **Node.js**: v18.0.0 o superior
- **PostgreSQL**: v14.0 o superior
- **Git**: Para clonar repositorios
- **PM2**: Para gestión de procesos (opcional pero recomendado)

---

## 📦 Estructura del Proyecto

```
crm-whatsapp-ai/
├── backend/              # Servidor Express + API
├── frontend/             # Cliente React + Vite
├── shared/               # Esquemas y tipos compartidos
└── docs/                 # Documentación
```

---

## 🛠️ Instalación Paso a Paso

### 1. Preparación del Servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js v18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Instalar PM2 (gestor de procesos)
sudo npm install -g pm2

# Instalar dependencias del sistema
sudo apt install -y build-essential python3-dev
```

### 2. Configuración de PostgreSQL

```bash
# Iniciar PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres psql
```

```sql
-- En consola PostgreSQL:
CREATE DATABASE crm_whatsapp_ai;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE crm_whatsapp_ai TO crm_user;
\q
```

### 3. Extracción y Configuración del Proyecto

```bash
# Crear directorio del proyecto
mkdir -p /var/www/crm-whatsapp-ai
cd /var/www/crm-whatsapp-ai

# Extraer archivos del ZIP (reemplazar con tu archivo)
unzip crm-whatsapp-ai-deployment.zip
```

### 4. Instalación del Backend

```bash
cd backend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
nano .env
```

**Archivo `.env` del Backend:**
```env
# Base de datos
DATABASE_URL="postgresql://crm_user:tu_password_seguro@localhost:5432/crm_whatsapp_ai"

# API Keys - OBTENER DE LOS PROVEEDORES
OPENAI_API_KEY="sk-tu_clave_openai_aqui"
GOOGLE_AI_API_KEY="tu_clave_gemini_aqui"
QWEN_API_KEY="tu_clave_qwen_aqui"

# Configuración del servidor
PORT=5000
NODE_ENV=production

# Configuración de sesiones
SESSION_SECRET="tu_secreto_de_sesion_muy_seguro_aqui"
```

```bash
# Ejecutar migraciones de base de datos
npm run db:push

# Probar el backend
npm run start
```

### 5. Instalación del Frontend

```bash
cd ../frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
nano .env
```

**Archivo `.env` del Frontend:**
```env
VITE_API_BASE_URL=http://tu-servidor.com:5000
VITE_WS_URL=ws://tu-servidor.com:5000
```

```bash
# Compilar para producción
npm run build

# Probar el frontend
npm run preview
```

---

## 🔑 Configuración de API Keys

### OpenAI
1. Ir a https://platform.openai.com/api-keys
2. Crear nueva clave API
3. Copiar la clave que comienza con "sk-"

### Google Gemini
1. Ir a https://makersuite.google.com/app/apikey
2. Crear nueva API key
3. Copiar la clave generada

### Qwen3 (Alibaba Cloud)
1. Ir a https://dashscope.aliyun.com/
2. Crear cuenta y obtener API key
3. Copiar la clave de acceso

---

## 🚀 Despliegue en Producción

### 1. Configuración con PM2

```bash
# Crear archivo de configuración PM2
nano ecosystem.config.js
```

**Archivo `ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [
    {
      name: 'crm-backend',
      script: './backend/index.ts',
      cwd: '/var/www/crm-whatsapp-ai',
      interpreter: 'tsx',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    },
    {
      name: 'crm-frontend',
      script: 'npm',
      args: 'run preview',
      cwd: '/var/www/crm-whatsapp-ai/frontend',
      env: {
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false
    }
  ]
};
```

```bash
# Iniciar aplicaciones con PM2
pm2 start ecosystem.config.js

# Guardar configuración PM2
pm2 save
pm2 startup
```

### 2. Configuración de Nginx (Proxy Reverso)

```bash
# Instalar Nginx
sudo apt install nginx -y

# Crear configuración del sitio
sudo nano /etc/nginx/sites-available/crm-whatsapp-ai
```

**Configuración Nginx:**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header Origin "";
    }
}
```

```bash
# Activar sitio
sudo ln -s /etc/nginx/sites-available/crm-whatsapp-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Configuración SSL (Opcional pero Recomendado)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com
```

---

## 🔒 Configuración de Seguridad

### 1. Firewall

```bash
# Configurar UFW
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Respaldos Automáticos

```bash
# Crear script de respaldo
sudo nano /opt/backup-crm.sh
```

**Script de respaldo:**
```bash
#!/bin/bash
BACKUP_DIR="/backup/crm-whatsapp-ai"
DATE=$(date +%Y%m%d_%H%M%S)

# Crear directorio de respaldo
mkdir -p $BACKUP_DIR

# Respaldar base de datos
pg_dump crm_whatsapp_ai > $BACKUP_DIR/db_backup_$DATE.sql

# Respaldar archivos de la aplicación
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz /var/www/crm-whatsapp-ai

# Limpiar respaldos antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Hacer ejecutable
sudo chmod +x /opt/backup-crm.sh

# Programar respaldo diario
sudo crontab -e
# Agregar línea: 0 2 * * * /opt/backup-crm.sh
```

---

## 📊 Monitoreo y Mantenimiento

### 1. Comandos PM2 Útiles

```bash
# Ver estado de aplicaciones
pm2 list

# Ver logs
pm2 logs

# Reiniciar aplicación
pm2 restart crm-backend
pm2 restart crm-frontend

# Monitoreo en tiempo real
pm2 monit
```

### 2. Logs del Sistema

```bash
# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### 3. Actualizaciones

```bash
# Detener aplicaciones
pm2 stop all

# Actualizar código
cd /var/www/crm-whatsapp-ai
# Reemplazar archivos con nueva versión

# Instalar nuevas dependencias
cd backend && npm install
cd ../frontend && npm install && npm run build

# Ejecutar migraciones si es necesario
cd ../backend && npm run db:push

# Reiniciar aplicaciones
pm2 restart all
```

---

## ⚠️ Solución de Problemas

### Error de Conexión a Base de Datos
```bash
# Verificar estado PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U crm_user -d crm_whatsapp_ai
```

### Error de Permisos de WhatsApp
- Verificar que el navegador tiene permisos para micrófono y cámara
- Comprobar que no hay otros procesos usando WhatsApp Web

### Alto Uso de Memoria
```bash
# Verificar uso de memoria
pm2 monit

# Reiniciar aplicación con problemas
pm2 restart crm-backend
```

### Error de API Keys
- Verificar que las claves están correctamente configuradas en `.env`
- Comprobar cuotas y límites en las plataformas de IA
- Revisar logs para errores específicos: `pm2 logs crm-backend`

---

## 📞 Soporte

Para soporte técnico o consultas:
- Revisar logs del sistema: `pm2 logs`
- Verificar estado de servicios: `sudo systemctl status postgresql nginx`
- Consultar documentación de las APIs utilizadas

---

## 🔄 Información de Versión

- **Versión del Sistema**: 1.0.0
- **Compatible con Node.js**: 18.x y superior
- **Compatible con PostgreSQL**: 14.x y superior
- **Última actualización**: Junio 2025