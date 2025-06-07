#!/bin/bash

# Quick Start Script para CRM WhatsApp AI
# Inicio rápido con todas las optimizaciones

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/quick-start.log"

# Crear directorio de logs
mkdir -p "$SCRIPT_DIR/logs"

# Función para logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🚀 Iniciando CRM WhatsApp AI - Modo Producción"

# Verificar que Node.js está instalado
if ! command -v node &> /dev/null; then
    log "❌ Error: Node.js no está instalado"
    exit 1
fi

# Verificar que npm está instalado
if ! command -v npm &> /dev/null; then
    log "❌ Error: npm no está instalado"
    exit 1
fi

# Navegar al directorio del proyecto
cd "$SCRIPT_DIR"

# Configurar variables de entorno optimizadas
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096 --gc-interval=100"
export UV_THREADPOOL_SIZE=16

log "✅ Variables de entorno configuradas"

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    log "📦 Instalando dependencias..."
    npm install --production
fi

# Crear directorios necesarios
mkdir -p {whatsapp-sessions,uploads,logs,temp,backups}
log "📁 Directorios creados"

# Verificar que la base de datos está accesible
log "🔍 Verificando conexión a la base de datos..."
if [ -z "$DATABASE_URL" ]; then
    log "⚠️ Advertencia: DATABASE_URL no está configurada"
else
    log "✅ DATABASE_URL configurada"
fi

# Verificar APIs de IA
if [ -z "$GEMINI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$QWEN_API_KEY" ]; then
    log "⚠️ Advertencia: No hay claves de API de IA configuradas"
else
    log "✅ Al menos una clave de API de IA está configurada"
fi

# Ejecutar migraciones de base de datos si es necesario
log "🗄️ Ejecutando migraciones de base de datos..."
npm run db:push || log "⚠️ Las migraciones podrían haber fallado, continuando..."

# Compilar aplicación si es necesario (modo desarrollo usa tsx)
log "🔨 Preparando aplicación..."

# Limpiar procesos anteriores en el puerto 5000
if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    log "🔄 Limpiando procesos existentes en puerto 5000..."
    pkill -f "node.*5000" || true
    sleep 2
fi

# Iniciar la aplicación
log "🚀 Iniciando servidor CRM WhatsApp AI..."
echo "Servidor iniciándose en http://localhost:5000"
echo "Presiona Ctrl+C para detener"

# Iniciar con npm run dev (que usa tsx para desarrollo)
npm run dev