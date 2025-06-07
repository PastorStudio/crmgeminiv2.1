# WhatsApp CRM - Guía de Despliegue GitHub + VPS

## 🎯 Instalación Automática con Wizard Interactivo

### Método 1: Instalación de Un Solo Comando

```bash
wget -O install-wizard.sh https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh
chmod +x install-wizard.sh
./install-wizard.sh
```

### Método 2: Clonación Manual + Wizard

```bash
git clone https://github.com/TU_USUARIO/whatsapp-crm-system.git
cd whatsapp-crm-system
chmod +x install-wizard.sh
./install-wizard.sh
```

## 🖥️ Compatibilidad de Sistemas

### Sistemas Operativos Soportados:
- ✅ Ubuntu 20.04 LTS
- ✅ Ubuntu 22.04 LTS  
- ✅ Debian 10 (Buster)
- ✅ Debian 11 (Bullseye)

### Proveedores VPS Probados:
- ✅ Contabo VPS
- ✅ DigitalOcean Droplets
- ✅ Amazon EC2
- ✅ Google Cloud VM
- ✅ Vultr VPS
- ✅ Linode
- ✅ Hetzner Cloud

## 🛠️ El Wizard Instalará Automáticamente:

### Dependencias del Sistema:
- Node.js 20 (último LTS)
- PostgreSQL 14+ con configuración optimizada
- PM2 para gestión de procesos
- Nginx como proxy reverso (opcional)
- Firewall UFW configurado
- Certificados SSL/HTTPS con Let's Encrypt (opcional)

### Configuración de Seguridad:
- Usuario de base de datos específico con permisos limitados
- Contraseñas generadas automáticamente con criptografía segura
- Tokens JWT y secretos de sesión únicos
- Firewall configurado con puertos específicos
- Configuración de proxy reverso con headers de seguridad

## 📋 Requisitos Previos VPS

### Especificaciones Mínimas:
- **RAM**: 1GB (recomendado 2GB+)
- **Disco**: 10GB libres (recomendado 20GB+)
- **CPU**: 1 vCPU (recomendado 2 vCPU+)
- **Red**: Conexión estable a internet

### Acceso Requerido:
- Acceso SSH root o usuario con sudo
- Puerto 22 (SSH) abierto
- Puertos 80, 443 (HTTP/HTTPS) disponibles
- Puerto 3000 (aplicación) disponible

## 🔧 Proceso de Instalación Interactiva

### Paso 1: Verificación del Sistema
El wizard verifica automáticamente:
- Sistema operativo compatible
- Conectividad a internet
- Permisos sudo disponibles
- Espacio en disco suficiente
- Memoria RAM disponible

### Paso 2: Configuración Personalizada
Te preguntará por:
- IP del servidor (autodetección disponible)
- Nombre de base de datos personalizado
- Usuario de base de datos
- Puerto de la aplicación
- Instalación de Nginx (opcional)
- Configuración SSL/HTTPS (opcional)
- Dominio personalizado (si usas SSL)

### Paso 3: Instalación Automática
- Actualización del sistema
- Instalación de todas las dependencias
- Configuración de base de datos PostgreSQL
- Construcción de la aplicación
- Configuración de Nginx (si seleccionado)
- Configuración de SSL (si seleccionado)
- Inicio de la aplicación con PM2

### Paso 4: Configuración Final
- Generación de archivo .env personalizado
- Configuración de variables de entorno
- Inicio automático del sistema
- Verificación de funcionamiento

## 🚀 Uso con Diferentes Proveedores

### Contabo VPS:
```bash
# Conectar por SSH
ssh root@tu-ip-contabo

# Ejecutar wizard
wget -O install-wizard.sh https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh
chmod +x install-wizard.sh
./install-wizard.sh
```

### DigitalOcean Droplet:
```bash
# Crear droplet Ubuntu 22.04
# Conectar por SSH
ssh root@tu-droplet-ip

# Ejecutar wizard
curl -sSL https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh | bash
```

### Amazon EC2:
```bash
# Conectar con tu .pem key
ssh -i tu-key.pem ubuntu@ec2-instance-ip

# Ejecutar wizard
wget -O install-wizard.sh https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh
chmod +x install-wizard.sh
./install-wizard.sh
```

## 🔐 Configuración de Claves API

Después de la instalación, debes configurar:

### OpenAI API Key (Obligatorio):
1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva clave API
3. Edita el archivo .env:
```bash
nano .env
```
4. Reemplaza `your_openai_key_here` con tu clave real
5. Reinicia la aplicación:
```bash
pm2 restart whatsapp-crm
```

### Claves Opcionales:
- Google AI API (para Gemini)
- Anthropic API (para Claude)
- Otras APIs según necesidades

## 📊 Monitoreo y Mantenimiento

### Comandos PM2 Básicos:
```bash
# Ver estado de la aplicación
pm2 status

# Ver logs en tiempo real
pm2 logs whatsapp-crm

# Reiniciar aplicación
pm2 restart whatsapp-crm

# Detener aplicación
pm2 stop whatsapp-crm

# Monitor con dashboard
pm2 monit
```

### Comandos de Sistema:
```bash
# Estado de Nginx
sudo systemctl status nginx

# Reiniciar Nginx
sudo systemctl restart nginx

# Estado de PostgreSQL
sudo systemctl status postgresql

# Ver logs del sistema
journalctl -u nginx -f
```

### Actualizaciones:
```bash
# Actualizar código desde GitHub
cd whatsapp-crm-system
git pull origin main
npm install
npm run build
pm2 restart whatsapp-crm
```

## 🌐 Acceso a la Aplicación

### Con Nginx (Recomendado):
- **HTTP**: `http://tu-servidor-ip`
- **HTTPS**: `https://tu-dominio.com` (si configuraste SSL)

### Acceso Directo:
- **Aplicación**: `http://tu-servidor-ip:3000`

### URLs Importantes:
- **Dashboard Principal**: `/`
- **Panel de WhatsApp**: `/whatsapp`
- **Gestión de Leads**: `/leads`
- **Configuración**: `/settings`
- **Documentación API**: `/api/docs`

## 🛡️ Seguridad y Backup

### Configuración de Firewall:
```bash
# Ver reglas activas
sudo ufw status

# Permitir nuevo puerto
sudo ufw allow PUERTO_NUMERO

# Bloquear IP específica
sudo ufw deny from IP_ADDRESS
```

### Backup de Base de Datos:
```bash
# Crear backup
pg_dump -U whatsapp_user -h localhost whatsapp_crm_db > backup.sql

# Restaurar backup
psql -U whatsapp_user -h localhost whatsapp_crm_db < backup.sql
```

### Backup Completo:
```bash
# Crear backup completo
tar -czf backup-$(date +%Y%m%d).tar.gz whatsapp-crm-system/

# Programar backups automáticos
echo "0 2 * * * cd /path/to && tar -czf backup-\$(date +\%Y\%m\%d).tar.gz whatsapp-crm-system/" | crontab -
```

## 🔧 Solución de Problemas

### Problemas Comunes:

#### Aplicación no inicia:
```bash
# Verificar logs
pm2 logs whatsapp-crm

# Verificar archivo .env
cat .env

# Verificar puerto disponible
netstat -tulpn | grep :3000
```

#### Error de base de datos:
```bash
# Verificar estado PostgreSQL
sudo systemctl status postgresql

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Verificar conexión
psql -U whatsapp_user -h localhost -d whatsapp_crm_db
```

#### Error 502 Nginx:
```bash
# Verificar configuración Nginx
sudo nginx -t

# Verificar logs Nginx
sudo tail -f /var/log/nginx/error.log

# Reiniciar servicios
sudo systemctl restart nginx
pm2 restart whatsapp-crm
```

### Comandos de Diagnóstico:
```bash
# Información del sistema
free -h          # Memoria
df -h            # Disco
top              # Procesos
ss -tulpn        # Puertos abiertos
```

## 📞 Soporte Técnico

### Logs Importantes:
- **Aplicación**: `pm2 logs whatsapp-crm`
- **Nginx**: `/var/log/nginx/error.log`
- **PostgreSQL**: `/var/log/postgresql/`
- **Sistema**: `journalctl -f`

### Información para Soporte:
1. Versión del sistema operativo: `lsb_release -a`
2. Logs de error completos
3. Configuración de .env (sin claves privadas)
4. Salida de `pm2 status`
5. Salida de `sudo nginx -t`

## 🎉 ¡Instalación Exitosa!

Si el wizard completó sin errores, tu sistema WhatsApp CRM está listo para:

1. ✅ Conexiones WhatsApp reales con códigos QR
2. ✅ Respuestas automáticas AI con OpenAI
3. ✅ Gestión completa de leads y tickets
4. ✅ Dashboard en tiempo real
5. ✅ API REST completa
6. ✅ Sistema de notificaciones
7. ✅ Análisis automático de conversaciones
8. ✅ Traducción automática de idiomas
9. ✅ Gestión de agentes externos
10. ✅ Backup y monitoreo integrado

**¡Tu CRM está listo para manejar comunicaciones reales de WhatsApp con inteligencia artificial!**