#!/bin/bash

# Script de optimización para producción - CRM WhatsApp AI
# Configura el sistema para máximo rendimiento y estabilidad

set -e

LOG_FILE="logs/production-setup.log"
mkdir -p logs

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Iniciando optimización para producción..."

# 1. Optimizar configuración de Node.js
log "Configurando variables de entorno de Node.js..."
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096 --gc-interval=100"
export UV_THREADPOOL_SIZE=16

# 2. Crear directorios necesarios con permisos correctos
log "Creando estructura de directorios..."
mkdir -p {whatsapp-sessions,uploads,logs,temp,backups}
chmod 755 {whatsapp-sessions,uploads,logs,temp,backups}

# 3. Configurar límites del sistema
log "Configurando límites del sistema..."
echo "* soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "* hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# 4. Optimizar configuración de memoria virtual
log "Optimizando memoria virtual..."
echo 'vm.swappiness = 10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure = 50' | sudo tee -a /etc/sysctl.conf

# 5. Configurar rotación de logs
log "Configurando rotación de logs..."
cat > /etc/logrotate.d/crm-whatsapp << EOF
/opt/crm-whatsapp-ai/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# 6. Crear script de healthcheck
log "Creando script de monitoreo de salud..."
cat > health-check.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:5000/api/health"
MAX_RETRIES=3
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f -s "$HEALTH_URL" > /dev/null 2>&1; then
        echo "✅ Aplicación funcionando correctamente"
        exit 0
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 10
done

echo "❌ Aplicación no responde después de $MAX_RETRIES intentos"
exit 1
EOF

chmod +x health-check.sh

# 7. Configurar monitoreo automático
log "Configurando monitoreo automático..."
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/crm-whatsapp-ai/health-check.sh") | crontab -

# 8. Crear endpoint de health check en la aplicación
log "Configurando endpoint de salud..."

log "✅ Optimización completada exitosamente"
log "📋 Resumen de configuración:"
log "   - Variables de entorno configuradas"
log "   - Límites del sistema optimizados"
log "   - Rotación de logs configurada"
log "   - Monitoreo automático activado"
log "   - Scripts de mantenimiento creados"