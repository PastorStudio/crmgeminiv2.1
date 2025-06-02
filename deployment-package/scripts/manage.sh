#!/bin/bash

# Script de gestión del Sistema CRM WhatsApp AI
# Autor: Sistema CRM WhatsApp AI
# Fecha: Junio 2025

set -e

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
    echo -e "${BLUE}$1${NC}"
}

# Variables
PROJECT_DIR="/var/www/crm-whatsapp-ai"

# Función para mostrar el menú principal
show_menu() {
    clear
    show_title "=== GESTIÓN DEL SISTEMA CRM WHATSAPP AI ==="
    echo ""
    echo "1. Ver estado de servicios"
    echo "2. Iniciar servicios"
    echo "3. Detener servicios"
    echo "4. Reiniciar servicios"
    echo "5. Ver logs en tiempo real"
    echo "6. Ver logs específicos"
    echo "7. Monitor de recursos"
    echo "8. Actualizar proyecto"
    echo "9. Configurar API keys"
    echo "10. Respaldo de base de datos"
    echo "11. Restaurar base de datos"
    echo "12. Ver información del sistema"
    echo "0. Salir"
    echo ""
    read -p "Selecciona una opción: " choice
}

# Función para ver estado de servicios
status_services() {
    show_message "Estado de los servicios:"
    pm2 list
    echo ""
    show_message "Puertos activos:"
    netstat -tuln | grep -E ":(3000|5000)"
    echo ""
    read -p "Presiona Enter para continuar..."
}

# Función para iniciar servicios
start_services() {
    show_message "Iniciando servicios..."
    cd "$PROJECT_DIR"
    pm2 start ecosystem.config.js
    pm2 save
    show_message "Servicios iniciados"
    read -p "Presiona Enter para continuar..."
}

# Función para detener servicios
stop_services() {
    show_message "Deteniendo servicios..."
    pm2 stop all
    show_message "Servicios detenidos"
    read -p "Presiona Enter para continuar..."
}

# Función para reiniciar servicios
restart_services() {
    show_message "Reiniciando servicios..."
    pm2 restart all
    show_message "Servicios reiniciados"
    read -p "Presiona Enter para continuar..."
}

# Función para ver logs en tiempo real
view_logs() {
    show_message "Mostrando logs en tiempo real (Ctrl+C para salir)..."
    pm2 logs
}

# Función para ver logs específicos
view_specific_logs() {
    echo "Selecciona el servicio:"
    echo "1. Backend (crm-backend)"
    echo "2. Frontend (crm-frontend)"
    echo "3. Todos"
    read -p "Opción: " log_choice
    
    case $log_choice in
        1) pm2 logs crm-backend ;;
        2) pm2 logs crm-frontend ;;
        3) pm2 logs ;;
        *) show_error "Opción inválida" ;;
    esac
}

# Función para monitor de recursos
monitor_resources() {
    show_message "Monitor de recursos (Ctrl+C para salir)..."
    pm2 monit
}

# Función para actualizar proyecto
update_project() {
    show_message "Actualizando proyecto..."
    
    cd "$PROJECT_DIR"
    
    # Detener servicios
    pm2 stop all
    
    # Actualizar dependencias del backend
    cd "$PROJECT_DIR/backend"
    npm install
    
    # Actualizar dependencias del frontend
    cd "$PROJECT_DIR/frontend"
    npm install
    npm run build
    
    # Ejecutar migraciones si es necesario
    cd "$PROJECT_DIR/backend"
    npm run db:push
    
    # Reiniciar servicios
    cd "$PROJECT_DIR"
    pm2 restart all
    
    show_message "Proyecto actualizado exitosamente"
    read -p "Presiona Enter para continuar..."
}

# Función para configurar API keys
configure_api_keys() {
    show_message "Configuración de API keys"
    
    ENV_FILE="$PROJECT_DIR/backend/.env"
    
    echo ""
    echo "API keys actuales:"
    grep -E "(OPENAI_API_KEY|GOOGLE_AI_API_KEY|QWEN_API_KEY)" "$ENV_FILE" | sed 's/=.*/=***OCULTA***/'
    echo ""
    
    echo "¿Qué API key quieres configurar?"
    echo "1. OpenAI API Key"
    echo "2. Google Gemini API Key"
    echo "3. Qwen3 API Key"
    echo "4. Ver todas las configuraciones"
    echo "0. Volver"
    
    read -p "Opción: " api_choice
    
    case $api_choice in
        1)
            read -p "Ingresa tu OpenAI API Key: " openai_key
            sed -i "s|OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$openai_key\"|" "$ENV_FILE"
            show_message "OpenAI API Key actualizada"
            ;;
        2)
            read -p "Ingresa tu Google Gemini API Key: " gemini_key
            sed -i "s|GOOGLE_AI_API_KEY=.*|GOOGLE_AI_API_KEY=\"$gemini_key\"|" "$ENV_FILE"
            show_message "Google Gemini API Key actualizada"
            ;;
        3)
            read -p "Ingresa tu Qwen3 API Key: " qwen_key
            sed -i "s|QWEN_API_KEY=.*|QWEN_API_KEY=\"$qwen_key\"|" "$ENV_FILE"
            show_message "Qwen3 API Key actualizada"
            ;;
        4)
            show_message "Configuraciones actuales:"
            cat "$ENV_FILE"
            ;;
        0)
            return
            ;;
        *)
            show_error "Opción inválida"
            ;;
    esac
    
    echo ""
    read -p "¿Reiniciar servicios para aplicar cambios? (y/N): " restart_confirm
    if [[ $restart_confirm =~ ^[Yy]$ ]]; then
        pm2 restart all
        show_message "Servicios reiniciados"
    fi
    
    read -p "Presiona Enter para continuar..."
}

# Función para respaldar base de datos
backup_database() {
    show_message "Creando respaldo de la base de datos..."
    
    BACKUP_DIR="/var/backups/crm-whatsapp-ai"
    DATE=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/db_backup_$DATE.sql"
    
    # Crear directorio de respaldo
    sudo mkdir -p "$BACKUP_DIR"
    
    # Obtener configuración de la base de datos
    source "$PROJECT_DIR/backend/.env"
    
    # Extraer datos de la URL de conexión
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    # Crear respaldo
    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE"
    
    show_message "Respaldo creado: $BACKUP_FILE"
    
    # Comprimir respaldo
    gzip "$BACKUP_FILE"
    show_message "Respaldo comprimido: $BACKUP_FILE.gz"
    
    read -p "Presiona Enter para continuar..."
}

# Función para restaurar base de datos
restore_database() {
    show_warning "¡ATENCIÓN! Esta operación sobrescribirá la base de datos actual."
    read -p "¿Estás seguro de continuar? (y/N): " confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        return
    fi
    
    BACKUP_DIR="/var/backups/crm-whatsapp-ai"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        show_error "No se encontró el directorio de respaldos: $BACKUP_DIR"
        read -p "Presiona Enter para continuar..."
        return
    fi
    
    echo "Respaldos disponibles:"
    ls -la "$BACKUP_DIR"/*.gz 2>/dev/null || echo "No hay respaldos disponibles"
    
    read -p "Ingresa el nombre completo del archivo de respaldo: " backup_file
    
    if [[ ! -f "$BACKUP_DIR/$backup_file" ]]; then
        show_error "Archivo no encontrado: $BACKUP_DIR/$backup_file"
        read -p "Presiona Enter para continuar..."
        return
    fi
    
    show_message "Restaurando base de datos desde $backup_file..."
    
    # Detener servicios
    pm2 stop all
    
    # Obtener configuración de la base de datos
    source "$PROJECT_DIR/backend/.env"
    
    # Extraer datos de la URL de conexión
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
    DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
    
    # Descomprimir y restaurar
    gunzip -c "$BACKUP_DIR/$backup_file" | PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
    
    # Reiniciar servicios
    pm2 restart all
    
    show_message "Base de datos restaurada exitosamente"
    read -p "Presiona Enter para continuar..."
}

# Función para mostrar información del sistema
system_info() {
    show_title "=== INFORMACIÓN DEL SISTEMA ==="
    echo ""
    echo "🖥️  Sistema operativo: $(lsb_release -d | cut -f2)"
    echo "💾 Memoria total: $(free -h | grep Mem | awk '{print $2}')"
    echo "💾 Memoria disponible: $(free -h | grep Mem | awk '{print $7}')"
    echo "💿 Espacio en disco: $(df -h / | tail -1 | awk '{print $4}') disponible"
    echo "🔧 Node.js: $(node --version)"
    echo "📦 NPM: $(npm --version)"
    echo "🐘 PostgreSQL: $(psql --version | awk '{print $3}')"
    echo "⚙️  PM2: $(pm2 --version)"
    echo ""
    echo "📂 Directorio del proyecto: $PROJECT_DIR"
    echo "📊 Estado de PM2:"
    pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.status)"' 2>/dev/null || pm2 list
    echo ""
    read -p "Presiona Enter para continuar..."
}

# Función principal
main() {
    while true; do
        show_menu
        
        case $choice in
            1) status_services ;;
            2) start_services ;;
            3) stop_services ;;
            4) restart_services ;;
            5) view_logs ;;
            6) view_specific_logs ;;
            7) monitor_resources ;;
            8) update_project ;;
            9) configure_api_keys ;;
            10) backup_database ;;
            11) restore_database ;;
            12) system_info ;;
            0) 
                show_message "¡Hasta luego!"
                exit 0
                ;;
            *)
                show_error "Opción inválida"
                read -p "Presiona Enter para continuar..."
                ;;
        esac
    done
}

# Verificar que PM2 esté instalado
if ! command -v pm2 &> /dev/null; then
    show_error "PM2 no está instalado. Ejecuta primero: ./scripts/install.sh"
    exit 1
fi

# Ejecutar menú principal
main