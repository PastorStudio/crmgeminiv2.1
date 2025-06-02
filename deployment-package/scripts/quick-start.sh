#!/bin/bash

# Script de inicio rápido para el Sistema CRM WhatsApp AI
# Autor: Sistema CRM WhatsApp AI
# Fecha: Junio 2025

set -e

echo "🚀 Inicio Rápido - Sistema CRM WhatsApp AI"

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

show_title() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Detectar el directorio actual
CURRENT_DIR=$(pwd)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Función para verificar si estamos en el directorio correcto
check_directory() {
    if [[ ! -f "$PROJECT_ROOT/package.json" ]] || [[ ! -f "$PROJECT_ROOT/ecosystem.config.js" ]]; then
        show_error "No se encontraron los archivos del proyecto. Asegúrate de estar en el directorio correcto."
        exit 1
    fi
}

# Función para verificar dependencias del sistema
check_system_deps() {
    show_message "Verificando dependencias del sistema..."
    
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+="Node.js"
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+="NPM"
    fi
    
    if ! command -v psql &> /dev/null; then
        missing_deps+="PostgreSQL"
    fi
    
    if ! command -v pm2 &> /dev/null; then
        missing_deps+="PM2"
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        show_error "Dependencias faltantes: ${missing_deps[*]}"
        echo ""
        show_message "Para instalar automáticamente, ejecuta:"
        echo "  chmod +x scripts/install.sh"
        echo "  ./scripts/install.sh"
        exit 1
    fi
    
    show_message "Todas las dependencias están instaladas"
}

# Función para configurar el proyecto por primera vez
first_time_setup() {
    show_title "CONFIGURACIÓN INICIAL"
    
    cd "$PROJECT_ROOT"
    
    # Instalar dependencias del backend
    show_message "Instalando dependencias del backend..."
    cd backend
    npm install
    
    # Instalar dependencias del frontend
    show_message "Instalando dependencias del frontend..."
    cd ../frontend
    npm install
    
    # Configurar variables de entorno
    show_message "Configurando variables de entorno..."
    
    # Backend
    cd ../backend
    if [[ ! -f .env ]]; then
        cp .env.example .env
        show_warning "Configuración inicial creada en backend/.env"
        show_warning "DEBES configurar las API keys antes de continuar"
    fi
    
    # Frontend
    cd ../frontend
    if [[ ! -f .env ]]; then
        cp .env.example .env
        show_message "Configuración del frontend creada"
    fi
    
    cd ..
}

# Función para verificar configuración de base de datos
check_database() {
    show_message "Verificando configuración de base de datos..."
    
    source "$PROJECT_ROOT/backend/.env"
    
    if [[ -z "$DATABASE_URL" ]] || [[ "$DATABASE_URL" == "postgresql://usuario:password@localhost:5432/crm_whatsapp_ai" ]]; then
        show_error "DATABASE_URL no está configurada correctamente"
        echo ""
        show_message "Opciones:"
        echo "1. Ejecutar instalación completa: ./scripts/install.sh"
        echo "2. Configurar manualmente en backend/.env"
        exit 1
    fi
    
    # Probar conexión a la base de datos
    if ! psql "$DATABASE_URL" -c "SELECT 1;" &> /dev/null; then
        show_error "No se puede conectar a la base de datos"
        show_warning "Verifica que PostgreSQL esté ejecutándose y la configuración sea correcta"
        exit 1
    fi
    
    show_message "Conexión a base de datos exitosa"
}

# Función para ejecutar migraciones
run_migrations() {
    show_message "Ejecutando migraciones de base de datos..."
    
    cd "$PROJECT_ROOT/backend"
    npm run db:push
    
    show_message "Migraciones completadas"
}

# Función para compilar el frontend
build_frontend() {
    show_message "Compilando frontend..."
    
    cd "$PROJECT_ROOT/frontend"
    npm run build
    
    show_message "Frontend compilado"
}

# Función para iniciar los servicios
start_services() {
    show_message "Iniciando servicios..."
    
    cd "$PROJECT_ROOT"
    
    # Detener servicios existentes
    pm2 delete crm-backend crm-frontend 2>/dev/null || true
    
    # Iniciar servicios
    pm2 start ecosystem.config.js
    pm2 save
    
    show_message "Servicios iniciados"
}

# Función para verificar que los servicios estén funcionando
verify_services() {
    show_message "Verificando servicios..."
    
    sleep 3
    
    # Verificar PM2
    if ! pm2 list | grep -q "crm-backend.*online"; then
        show_error "El backend no está ejecutándose"
        pm2 logs crm-backend --lines 10
        exit 1
    fi
    
    if ! pm2 list | grep -q "crm-frontend.*online"; then
        show_error "El frontend no está ejecutándose"
        pm2 logs crm-frontend --lines 10
        exit 1
    fi
    
    show_message "Todos los servicios están funcionando"
}

# Función para mostrar información de acceso
show_access_info() {
    show_title "SISTEMA INICIADO EXITOSAMENTE"
    
    local server_ip=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo "🌐 URLs de acceso:"
    echo "  Frontend: http://$server_ip:3000"
    echo "  Backend:  http://$server_ip:5000"
    echo ""
    echo "📊 Comandos útiles:"
    echo "  Ver estado:     pm2 list"
    echo "  Ver logs:       pm2 logs"
    echo "  Monitorear:     pm2 monit"
    echo "  Gestionar:      ./scripts/manage.sh"
    echo ""
    echo "🔧 Próximos pasos:"
    echo "  1. Accede al frontend en tu navegador"
    echo "  2. Configura las API keys en Configuración"
    echo "  3. Conecta tu cuenta de WhatsApp"
    echo ""
}

# Función para verificar API keys
check_api_keys() {
    source "$PROJECT_ROOT/backend/.env"
    
    local missing_keys=()
    
    if [[ -z "$OPENAI_API_KEY" ]] || [[ "$OPENAI_API_KEY" == "sk-tu_clave_openai_aqui" ]]; then
        missing_keys+=("OpenAI")
    fi
    
    if [[ -z "$GOOGLE_AI_API_KEY" ]] || [[ "$GOOGLE_AI_API_KEY" == "tu_clave_gemini_aqui" ]]; then
        missing_keys+=("Google Gemini")
    fi
    
    if [[ ${#missing_keys[@]} -gt 0 ]]; then
        show_warning "API keys no configuradas: ${missing_keys[*]}"
        show_warning "El sistema funcionará pero las respuestas automáticas estarán limitadas"
        echo ""
        read -p "¿Deseas configurar las API keys ahora? (y/N): " configure_keys
        
        if [[ $configure_keys =~ ^[Yy]$ ]]; then
            ./scripts/manage.sh
            exit 0
        fi
    else
        show_message "API keys configuradas correctamente"
    fi
}

# Función principal
main() {
    show_title "INICIO RÁPIDO DEL SISTEMA CRM WHATSAPP AI"
    
    # Verificaciones iniciales
    check_directory
    check_system_deps
    
    # Configuración inicial si es necesario
    if [[ ! -f "$PROJECT_ROOT/backend/.env" ]] || [[ ! -d "$PROJECT_ROOT/backend/node_modules" ]]; then
        show_message "Primera ejecución detectada"
        first_time_setup
    fi
    
    # Verificaciones de configuración
    check_database
    check_api_keys
    
    # Preparación y inicio
    run_migrations
    build_frontend
    start_services
    verify_services
    
    # Información final
    show_access_info
}

# Manejo de errores
trap 'show_error "Inicio interrumpido"; exit 1' INT TERM

# Ejecutar
main "$@"