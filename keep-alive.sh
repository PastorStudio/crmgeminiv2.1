#!/bin/bash

# Script para mantener el sistema CRM WhatsApp siempre corriendo
# Uso: ./keep-alive.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/logs/keep-alive.log"
PID_FILE="$SCRIPT_DIR/app.pid"

# Crear directorio de logs si no existe
mkdir -p "$SCRIPT_DIR/logs"

# Función para logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Función para verificar si la aplicación está corriendo
is_app_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Función para iniciar la aplicación
start_app() {
    log "Iniciando aplicación CRM WhatsApp..."
    cd "$SCRIPT_DIR"
    
    # Verificar dependencias
    if ! command -v node &> /dev/null; then
        log "ERROR: Node.js no está instalado"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log "ERROR: npm no está instalado"
        exit 1
    fi
    
    # Instalar dependencias si es necesario
    if [ ! -d "node_modules" ]; then
        log "Instalando dependencias..."
        npm install
    fi
    
    # Iniciar en modo producción
    export NODE_ENV=production
    nohup npm run dev > "$SCRIPT_DIR/logs/app.log" 2>&1 &
    echo $! > "$PID_FILE"
    log "Aplicación iniciada con PID $(cat $PID_FILE)"
}

# Función para detener la aplicación
stop_app() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        log "Deteniendo aplicación (PID: $pid)..."
        kill "$pid" 2>/dev/null
        rm -f "$PID_FILE"
        log "Aplicación detenida"
    else
        log "No se encontró PID de la aplicación"
    fi
}

# Función para reiniciar la aplicación
restart_app() {
    log "Reiniciando aplicación..."
    stop_app
    sleep 5
    start_app
}

# Función para verificar la salud de la aplicación
health_check() {
    # Verificar si el puerto 5000 está en uso
    if lsof -Pi :5000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Función principal de monitoreo
monitor() {
    log "Iniciando monitoreo del sistema CRM WhatsApp..."
    
    while true; do
        if is_app_running; then
            # Verificar salud de la aplicación
            if health_check; then
                log "✅ Sistema funcionando correctamente"
            else
                log "⚠️ Aplicación corriendo pero puerto no responde, reiniciando..."
                restart_app
            fi
        else
            log "❌ Aplicación no está corriendo, iniciando..."
            start_app
        fi
        
        # Esperar 30 segundos antes de la siguiente verificación
        sleep 30
    done
}

# Manejar señales del sistema
trap 'log "Recibida señal de terminación, deteniendo monitor..."; stop_app; exit 0' SIGTERM SIGINT

# Función principal
case "$1" in
    start)
        start_app
        ;;
    stop)
        stop_app
        ;;
    restart)
        restart_app
        ;;
    monitor)
        monitor
        ;;
    status)
        if is_app_running; then
            log "✅ Aplicación está corriendo (PID: $(cat $PID_FILE))"
        else
            log "❌ Aplicación no está corriendo"
        fi
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|monitor|status}"
        echo ""
        echo "  start   - Iniciar la aplicación"
        echo "  stop    - Detener la aplicación"
        echo "  restart - Reiniciar la aplicación"
        echo "  monitor - Monitorear y mantener la aplicación corriendo"
        echo "  status  - Verificar estado de la aplicación"
        exit 1
        ;;
esac