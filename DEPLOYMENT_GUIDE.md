# Guía Completa de Deployment - CRM WhatsApp AI

## 🚀 Opciones de Deployment

### 1. Servidor VPS/Dedicado (Recomendado)

#### Instalación Rápida con Script Automático
```bash
# Hacer ejecutable el script de keep-alive
chmod +x keep-alive.sh

# Iniciar la aplicación
./keep-alive.sh start

# Monitorear continuamente (recomendado para producción)
./keep-alive.sh monitor
```

#### Configuración con Systemd (Ubuntu/Debian)
```bash
# 1. Copiar el archivo de servicio
sudo cp systemd-service.conf /etc/systemd/system/crm-whatsapp.service

# 2. Recargar systemd
sudo systemctl daemon-reload

# 3. Habilitar el servicio para inicio automático
sudo systemctl enable crm-whatsapp

# 4. Iniciar el servicio
sudo systemctl start crm-whatsapp

# 5. Verificar estado
sudo systemctl status crm-whatsapp

# 6. Ver logs en tiempo real
sudo journalctl -u crm-whatsapp -f
```

#### Comandos de Gestión del Servicio
```bash
# Iniciar
sudo systemctl start crm-whatsapp

# Detener
sudo systemctl stop crm-whatsapp

# Reiniciar
sudo systemctl restart crm-whatsapp

# Estado
sudo systemctl status crm-whatsapp

# Deshabilitar inicio automático
sudo systemctl disable crm-whatsapp
```

### 2. Docker (Para Escalabilidad)

#### Preparación del Entorno
```bash
# 1. Crear archivo de variables de entorno
cat > .env << EOF
DATABASE_URL=postgresql://postgres:secure_password_123@postgres:5432/crm_whatsapp_ai
POSTGRES_PASSWORD=secure_password_123
GEMINI_API_KEY=tu_clave_gemini_aqui
OPENAI_API_KEY=tu_clave_openai_aqui
QWEN_API_KEY=tu_clave_qwen_aqui
EOF

# 2. Iniciar con Docker Compose
docker-compose -f docker-compose.production.yml up -d

# 3. Ver logs
docker-compose -f docker-compose.production.yml logs -f

# 4. Verificar estado
docker-compose -f docker-compose.production.yml ps
```

#### Comandos Docker Útiles
```bash
# Detener todos los servicios
docker-compose -f docker-compose.production.yml down

# Reiniciar solo la aplicación
docker-compose -f docker-compose.production.yml restart app

# Acceder al contenedor
docker exec -it crm-whatsapp-ai bash

# Ver logs de un servicio específico
docker-compose -f docker-compose.production.yml logs -f app
```

### 3. PM2 (Process Manager)

#### Instalación y Configuración
```bash
# 1. Instalar PM2 globalmente
npm install -g pm2

# 2. Usar el archivo ecosystem existente
pm2 start ecosystem.config.js

# 3. Guardar configuración para reinicio automático
pm2 save

# 4. Configurar inicio automático del sistema
pm2 startup

# 5. Verificar estado
pm2 status
```

#### Comandos PM2 Útiles
```bash
# Ver estado de todos los procesos
pm2 list

# Ver logs en tiempo real
pm2 logs

# Reiniciar aplicación
pm2 restart crm-whatsapp-ai

# Detener aplicación
pm2 stop crm-whatsapp-ai

# Eliminar de PM2
pm2 delete crm-whatsapp-ai

# Monitoreo en tiempo real
pm2 monit
```

## 🔧 Configuración de Producción

### Variables de Entorno Requeridas
```bash
# Base de datos
DATABASE_URL=postgresql://usuario:password@host:5432/database

# APIs de IA (al menos una requerida)
GEMINI_API_KEY=tu_clave_gemini
OPENAI_API_KEY=tu_clave_openai
QWEN_API_KEY=tu_clave_qwen

# Configuración del servidor
NODE_ENV=production
PORT=5000
```

### Configuración de Nginx (Proxy Reverso)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}
```

### SSL con Certbot (HTTPS)
```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com

# Renovación automática (opcional)
sudo crontab -e
# Agregar: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 🔍 Monitoreo y Mantenimiento

### Verificación de Estado
```bash
# Verificar si la aplicación responde
curl http://localhost:5000/api/health

# Verificar uso de recursos
htop
df -h
free -h

# Verificar logs
tail -f logs/app.log
tail -f logs/keep-alive.log
```

### Backup Automático
```bash
# Script de backup diario
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
mkdir -p $BACKUP_DIR

# Backup de base de datos
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Backup de sesiones WhatsApp
tar -czf $BACKUP_DIR/sessions_backup_$DATE.tar.gz whatsapp-sessions/

# Limpiar backups antiguos (mantener 7 días)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x backup.sh

# Programar backup diario
(crontab -l 2>/dev/null; echo "0 2 * * * /path/to/backup.sh") | crontab -
```

## 🛠 Solución de Problemas

### Problemas Comunes

1. **Puerto en uso**
```bash
# Encontrar proceso usando el puerto
sudo lsof -i :5000
# Terminar proceso si es necesario
sudo kill -9 PID
```

2. **Base de datos no conecta**
```bash
# Verificar PostgreSQL
sudo systemctl status postgresql
# Reiniciar si es necesario
sudo systemctl restart postgresql
```

3. **WhatsApp no se conecta**
```bash
# Limpiar sesión y regenerar QR
rm -rf whatsapp-sessions/*
# Reiniciar aplicación
```

4. **Memoria insuficiente**
```bash
# Verificar uso de memoria
free -h
# Agregar swap si es necesario
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Logs Importantes
```bash
# Logs de la aplicación
tail -f logs/app.log

# Logs del sistema (systemd)
sudo journalctl -u crm-whatsapp -f

# Logs de Docker
docker logs crm-whatsapp-ai -f

# Logs de PM2
pm2 logs crm-whatsapp-ai
```

## 📊 Optimización de Performance

### Configuración de Node.js
```bash
# Aumentar límites de memoria
export NODE_OPTIONS="--max-old-space-size=4096"

# Optimizar para producción
export NODE_ENV=production
```

### Configuración de Base de Datos
```sql
-- Optimizar PostgreSQL para producción
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
SELECT pg_reload_conf();
```

## 🔐 Seguridad

### Firewall (UFW)
```bash
# Habilitar firewall
sudo ufw enable

# Permitir SSH
sudo ufw allow ssh

# Permitir HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Permitir puerto de la aplicación (solo si no usas proxy)
sudo ufw allow 5000
```

### Actualizaciones de Seguridad
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Actualizar dependencias Node.js
npm audit fix

# Actualizar PM2
npm install -g pm2@latest
pm2 update
```

## 📞 Soporte

Para problemas o consultas:
1. Verificar logs de error
2. Consultar esta guía
3. Verificar estado de todos los servicios
4. Contactar soporte técnico con logs específicos