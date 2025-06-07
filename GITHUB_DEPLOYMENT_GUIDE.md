# 🚀 WhatsApp CRM - Guía Completa de Despliegue

## Instalación Automática con Wizard Interactivo

### Un Solo Comando - Instalación Completa

```bash
curl -sSL https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh | bash
```

**O descarga y ejecuta:**

```bash
wget https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh
chmod +x install-wizard.sh
./install-wizard.sh
```

## ¿Qué Hace el Wizard Automáticamente?

### ✅ Verificación del Sistema
- Detecta Ubuntu/Debian automáticamente
- Verifica conectividad y permisos
- Comprueba recursos disponibles

### ✅ Instalación Completa
- Node.js 20 (última versión LTS)
- PostgreSQL con configuración segura
- PM2 para gestión de procesos
- Nginx como proxy reverso (opcional)
- Firewall UFW configurado
- SSL/HTTPS con Let's Encrypt (opcional)

### ✅ Configuración Personalizada
- Base de datos con credenciales únicas
- Variables de entorno seguras
- Puertos personalizables
- Dominio personalizado (opcional)

### ✅ Seguridad Integrada
- Contraseñas generadas criptográficamente
- Usuario de BD con permisos limitados
- Firewall configurado automáticamente
- Tokens JWT únicos

## Compatibilidad Completa

### Sistemas Operativos:
- Ubuntu 20.04 LTS ✅
- Ubuntu 22.04 LTS ✅
- Debian 10 (Buster) ✅
- Debian 11 (Bullseye) ✅

### Proveedores VPS:
- Contabo VPS ✅
- DigitalOcean ✅
- Amazon EC2 ✅
- Google Cloud ✅
- Vultr ✅
- Linode ✅
- Hetzner Cloud ✅

## Requisitos Mínimos VPS

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| RAM | 1GB | 2GB+ |
| Disco | 10GB | 20GB+ |
| CPU | 1 vCPU | 2 vCPU+ |
| Puertos | 22, 80, 443, 3000 | Abiertos |

## Instalación Paso a Paso

### 1. Conectar a tu VPS

**Contabo:**
```bash
ssh root@tu-ip-contabo
```

**DigitalOcean:**
```bash
ssh root@tu-droplet-ip
```

**AWS EC2:**
```bash
ssh -i tu-key.pem ubuntu@ec2-ip
```

### 2. Ejecutar el Wizard

```bash
wget https://raw.githubusercontent.com/TU_USUARIO/whatsapp-crm-system/main/install-wizard.sh
chmod +x install-wizard.sh
./install-wizard.sh
```

### 3. Seguir las Instrucciones Interactivas

El wizard te guiará a través de:

1. **Verificación del sistema** (automática)
2. **Configuración personalizada** (interactiva)
3. **Instalación de dependencias** (automática)
4. **Configuración de base de datos** (automática)
5. **Construcción de la aplicación** (automática)
6. **Configuración de Nginx** (opcional)
7. **Inicio de la aplicación** (automática)
8. **Resumen de configuración** (informativo)

### 4. Configurar Claves API

Después de la instalación:

```bash
nano .env
```

Agregar tu clave OpenAI:
```env
OPENAI_API_KEY=sk-tu-clave-aqui
```

Reiniciar la aplicación:
```bash
pm2 restart whatsapp-crm
```

## Acceso a tu Sistema

### URLs de Acceso:
- **Con Nginx**: `http://tu-servidor-ip`
- **Directo**: `http://tu-servidor-ip:3000`
- **Con SSL**: `https://tu-dominio.com`

### Funcionalidades Disponibles:
- Dashboard principal con métricas en tiempo real
- Conexión WhatsApp con código QR
- Gestión completa de leads y tickets
- Respuestas automáticas AI
- Análisis de conversaciones
- Traducción automática
- Gestión de agentes externos
- API REST completa

## Comandos de Gestión

### PM2 (Gestión de Procesos):
```bash
pm2 status                # Ver estado
pm2 logs whatsapp-crm     # Ver logs
pm2 restart whatsapp-crm  # Reiniciar
pm2 stop whatsapp-crm     # Detener
pm2 monit                 # Monitor gráfico
```

### Nginx (Si instalado):
```bash
sudo systemctl status nginx     # Estado
sudo systemctl restart nginx    # Reiniciar
sudo nginx -t                   # Verificar configuración
```

### Base de Datos:
```bash
# Backup
pg_dump -U whatsapp_user -h localhost whatsapp_crm_db > backup.sql

# Verificar conexión
psql -U whatsapp_user -h localhost -d whatsapp_crm_db
```

## Actualizaciones

### Actualizar desde GitHub:
```bash
cd whatsapp-crm-system
git pull origin main
npm install
npm run build
pm2 restart whatsapp-crm
```

### Actualizar dependencias:
```bash
npm update
npm audit fix
pm2 restart whatsapp-crm
```

## Monitoreo y Logs

### Ver logs en tiempo real:
```bash
pm2 logs whatsapp-crm --lines 100
```

### Logs del sistema:
```bash
# Nginx
sudo tail -f /var/log/nginx/error.log

# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log

# Sistema
journalctl -f
```

### Métricas del servidor:
```bash
htop                    # Uso de CPU/RAM
df -h                   # Espacio en disco
ss -tulpn               # Puertos abiertos
```

## Solución de Problemas

### Aplicación no inicia:
```bash
# Verificar logs
pm2 logs whatsapp-crm

# Verificar configuración
cat .env

# Verificar puerto
netstat -tulpn | grep :3000
```

### Error de base de datos:
```bash
# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Verificar estado
sudo systemctl status postgresql
```

### Error 502 (Nginx):
```bash
# Verificar configuración
sudo nginx -t

# Reiniciar servicios
sudo systemctl restart nginx
pm2 restart whatsapp-crm
```

## Backup y Seguridad

### Backup automático:
```bash
# Crear script de backup
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U whatsapp_user -h localhost whatsapp_crm_db > backup_db_$DATE.sql
tar -czf backup_full_$DATE.tar.gz whatsapp-crm-system/
EOF

chmod +x backup.sh
```

### Programar backups:
```bash
# Añadir a crontab (backup diario a las 2 AM)
echo "0 2 * * * /path/to/backup.sh" | crontab -
```

### Configurar firewall:
```bash
# Ver reglas activas
sudo ufw status

# Permitir puerto específico
sudo ufw allow 8080

# Bloquear IP
sudo ufw deny from 192.168.1.100
```

## Funcionalidades del Sistema

### ✅ Características Principales:
- Conexiones WhatsApp reales con autenticación QR
- Respuestas automáticas AI con OpenAI/Gemini
- Gestión completa de leads con cards visuales
- Sistema de tickets integrado
- Dashboard con métricas en tiempo real
- Análisis automático de conversaciones cada 5 segundos
- Traducción automática a 60+ idiomas
- Gestión de agentes externos
- API REST completa
- WebSocket para notificaciones en tiempo real

### ✅ Seguridad y Rendimiento:
- Autenticación JWT
- Sesiones seguras
- Proxy reverso Nginx
- Compresión y caché
- Gestión de procesos con PM2
- Base de datos PostgreSQL optimizada
- Firewall configurado
- SSL/HTTPS automático

## Soporte Técnico

### Información necesaria para soporte:
1. Salida de `pm2 logs whatsapp-crm`
2. Contenido de `.env` (sin claves privadas)
3. Salida de `pm2 status`
4. Versión del sistema: `lsb_release -a`
5. Logs de error específicos

### Contacto:
- Documentación: Este README
- Logs del sistema: `pm2 logs`
- Estado del servicio: `pm2 status`

## ¡Instalación Exitosa!

Si el wizard completó sin errores, tu sistema WhatsApp CRM está completamente operativo con:

🎉 **Conexiones WhatsApp reales**
🎉 **Inteligencia artificial integrada**  
🎉 **Dashboard profesional**
🎉 **Gestión completa de leads**
🎉 **Sistema de respuestas automáticas**
🎉 **Análisis en tiempo real**
🎉 **Traducción automática**
🎉 **API REST completa**
🎉 **Monitoreo y backup integrado**
🎉 **Seguridad empresarial**

**Tu CRM está listo para manejar comunicaciones profesionales de WhatsApp con inteligencia artificial avanzada.**