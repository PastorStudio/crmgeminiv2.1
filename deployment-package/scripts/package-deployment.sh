#!/bin/bash

# Script para crear paquete de despliegue completo
# Sistema CRM WhatsApp AI

set -e

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

show_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

show_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

show_title() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="crm-whatsapp-ai-deployment-$TIMESTAMP"

show_title "CREANDO PAQUETE DE DESPLIEGUE"

cd "$PROJECT_ROOT"

# Crear directorio temporal para el paquete
show_message "Preparando paquete..."
TEMP_DIR="/tmp/$PACKAGE_NAME"
mkdir -p "$TEMP_DIR"

# Copiar archivos del proyecto
show_message "Copiando archivos del proyecto..."
cp -r backend "$TEMP_DIR/"
cp -r frontend "$TEMP_DIR/"
cp -r shared "$TEMP_DIR/"
cp -r docs "$TEMP_DIR/"
cp -r scripts "$TEMP_DIR/"

# Copiar archivos de configuración
cp package.json "$TEMP_DIR/" 2>/dev/null || true
cp ecosystem.config.js "$TEMP_DIR/"
cp README.md "$TEMP_DIR/"

# Limpiar node_modules si existen
show_message "Limpiando archivos temporales..."
find "$TEMP_DIR" -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name ".git" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name "dist" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name "build" -type d -exec rm -rf {} + 2>/dev/null || true
find "$TEMP_DIR" -name ".env" -type f -delete 2>/dev/null || true
find "$TEMP_DIR" -name "*.log" -type f -delete 2>/dev/null || true

# Hacer ejecutables los scripts
show_message "Configurando permisos..."
chmod +x "$TEMP_DIR/scripts"/*.sh

# Crear directorios necesarios
mkdir -p "$TEMP_DIR/logs"

# Crear archivo de información del paquete
show_message "Generando información del paquete..."
cat > "$TEMP_DIR/PACKAGE_INFO.txt" << EOF
Sistema CRM WhatsApp AI - Paquete de Despliegue
Fecha de creación: $(date)
Versión: 1.0.0

Contenido del paquete:
- backend/          Servidor Express con APIs y servicios
- frontend/         Cliente React con interfaz moderna
- shared/           Esquemas y tipos compartidos
- scripts/          Herramientas de instalación y gestión
- docs/             Documentación completa
- ecosystem.config.js  Configuración PM2

Scripts disponibles:
- scripts/install.sh      Instalación completa automática
- scripts/quick-start.sh  Inicio rápido
- scripts/deploy.sh       Despliegue en servidor existente
- scripts/manage.sh       Gestión del sistema
- scripts/nginx-setup.sh  Configuración de proxy reverso

Requisitos del sistema:
- Ubuntu/Debian Linux
- Node.js 18+
- PostgreSQL 14+
- 4GB RAM mínimo
- 20GB espacio en disco

Para comenzar:
1. Extraer: tar -xzf $PACKAGE_NAME.tar.gz
2. Ejecutar: cd $PACKAGE_NAME && ./scripts/install.sh
3. Configurar API keys en backend/.env
4. Iniciar: ./scripts/quick-start.sh

Soporte: Consultar docs/DEPLOYMENT_GUIDE.md
EOF

# Crear archivo comprimido
show_message "Comprimiendo paquete..."
cd /tmp
tar -czf "$PROJECT_ROOT/$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"

# Limpiar directorio temporal
rm -rf "$TEMP_DIR"

# Información final
show_title "PAQUETE CREADO EXITOSAMENTE"
echo ""
show_message "Archivo: $PACKAGE_NAME.tar.gz"
show_message "Tamaño: $(du -h "$PROJECT_ROOT/$PACKAGE_NAME.tar.gz" | cut -f1)"
echo ""
echo "📦 Para usar el paquete:"
echo "  1. Transferir a servidor: scp $PACKAGE_NAME.tar.gz user@server:~/"
echo "  2. Extraer: tar -xzf $PACKAGE_NAME.tar.gz"
echo "  3. Instalar: cd $PACKAGE_NAME && ./scripts/install.sh"
echo ""
echo "🚀 Scripts incluidos:"
echo "  - Instalación completa automática"
echo "  - Inicio rápido para desarrollo"
echo "  - Gestión del sistema en producción"
echo "  - Configuración de Nginx"
echo ""
echo "📚 Documentación completa en docs/DEPLOYMENT_GUIDE.md"