#!/bin/bash

# Script de despliegue rápido del Sistema CRM WhatsApp AI
# Autor: Sistema CRM WhatsApp AI
# Fecha: Junio 2025

set -e

echo "🚀 Iniciando despliegue del Sistema CRM WhatsApp AI..."

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

show_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

show_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

show_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables
PROJECT_DIR="/var/www/crm-whatsapp-ai"
CURRENT_DIR=$(pwd)

# Función para verificar requisitos
check_requirements() {
    show_message "Verificando requisitos del sistema..."
    
    # Verificar Node.js
    if ! command -v node &> /dev/null; then
        show_error "Node.js no está instalado. Ejecuta primero: ./scripts/install.sh"
        exit 1
    fi
    
    # Verificar PostgreSQL
    if ! command -v psql &> /dev/null; then
        show_error "PostgreSQL no está instalado. Ejecuta primero: ./scripts/install.sh"
        exit 1
    fi
    
    # Verificar PM2
    if ! command -v pm2 &> /dev/null; then
        show_error "PM2 no está instalado. Ejecuta primero: ./scripts/install.sh"
        exit 1
    fi
    
    show_message "Todos los requisitos están instalados"
}

# Función para verificar variables de entorno
check_env_vars() {
    show_message "Verificando configuración de variables de entorno..."
    
    if [[ ! -f "$PROJECT_DIR/backend/.env" ]]; then
        show_error "Archivo .env no encontrado en $PROJECT_DIR/backend/"
        show_warning "Ejecuta primero: ./scripts/install.sh"
        exit 1
    fi
    
    # Verificar que las API keys estén configuradas
    source "$PROJECT_DIR/backend/.env"
    
    if [[ -z "$DATABASE_URL" ]]; then
        show_error "DATABASE_URL no está configurada en .env"
        exit 1
    fi
    
    show_message "Variables de entorno verificadas"
    
    # Mostrar advertencia si las API keys no están configuradas
    if [[ "$OPENAI_API_KEY" == "sk-tu_clave_openai_aqui" ]] || [[ -z "$OPENAI_API_KEY" ]]; then
        show_warning "OPENAI_API_KEY no está configurada"
    fi
    
    if [[ "$GOOGLE_AI_API_KEY" == "tu_clave_gemini_aqui" ]] || [[ -z "$GOOGLE_AI_API_KEY" ]]; then
        show_warning "GOOGLE_AI_API_KEY no está configurada"
    fi
}

# Función para compilar y actualizar el proyecto
build_project() {
    show_message "Compilando proyecto..."
    
    # Compilar frontend
    cd "$PROJECT_DIR/frontend"
    npm run build
    
    show_message "Proyecto compilado exitosamente"
}

# Función para iniciar servicios
start_services() {
    show_message "Iniciando servicios con PM2..."
    
    cd "$PROJECT_DIR"
    
    # Detener servicios existentes si están corriendo
    pm2 delete crm-backend crm-frontend 2>/dev/null || true
    
    # Iniciar servicios
    pm2 start ecosystem.config.js
    
    # Guardar configuración de PM2
    pm2 save
    
    show_message "Servicios iniciados exitosamente"
}

# Función para verificar el estado de los servicios
check_services() {
    show_message "Verificando estado de los servicios..."
    
    sleep 5  # Esperar a que los servicios se inicien
    
    # Verificar estado de PM2
    pm2 list
    
    # Verificar que los puertos estén abiertos
    if netstat -tuln | grep -q ":5000"; then
        show_message "Backend ejecutándose en puerto 5000"
    else
        show_error "Backend no está ejecutándose en puerto 5000"
    fi
    
    if netstat -tuln | grep -q ":3000"; then
        show_message "Frontend ejecutándose en puerto 3000"
    else
        show_error "Frontend no está ejecutándose en puerto 3000"
    fi
}

# Función para mostrar información de acceso
show_access_info() {
    show_message "=== INFORMACIÓN DE ACCESO ==="
    echo ""
    echo "🌐 URLs de acceso:"
    echo "  - Frontend: http://$(hostname -I | awk '{print $1}'):3000"
    echo "  - Backend: http://$(hostname -I | awk '{print $1}'):5000"
    echo ""
    echo "📊 Comandos de monitoreo:"
    echo "  - Ver estado: pm2 list"
    echo "  - Ver logs: pm2 logs"
    echo "  - Monitoreo: pm2 monit"
    echo "  - Reiniciar: pm2 restart all"
    echo ""
    echo "🔧 Comandos útiles:"
    echo "  - Detener: pm2 stop all"
    echo "  - Recargar: pm2 reload all"
    echo "  - Ver logs específicos: pm2 logs crm-backend"
    echo ""
}

# Función principal
main() {
    show_message "=== DESPLIEGUE DEL SISTEMA CRM WHATSAPP AI ==="
    
    # Verificar que estamos en el directorio correcto
    if [[ ! -f "$CURRENT_DIR/ecosystem.config.js" ]]; then
        show_error "No se encontró ecosystem.config.js. Asegúrate de estar en el directorio del proyecto."
        exit 1
    fi
    
    # Ejecutar verificaciones y despliegue
    check_requirements
    check_env_vars
    build_project
    start_services
    check_services
    show_access_info
    
    echo ""
    echo -e "${GREEN}✅ Despliegue completado exitosamente${NC}"
    echo ""
    show_warning "Recuerda configurar las API keys en $PROJECT_DIR/backend/.env si aún no lo has hecho:"
    echo "  - OPENAI_API_KEY"
    echo "  - GOOGLE_AI_API_KEY"
    echo "  - QWEN_API_KEY"
}

# Manejo de errores
trap 'show_error "Despliegue interrumpido"; exit 1' INT TERM

# Ejecutar despliegue
main "$@"