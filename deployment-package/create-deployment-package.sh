#!/bin/bash

# Script para crear el paquete de despliegue completo
# Autor: Sistema CRM WhatsApp AI
# Fecha: Junio 2025

echo "🚀 Creando paquete de despliegue CRM WhatsApp AI..."

# Crear directorios de logs
mkdir -p logs

# Configurar permisos
chmod +x ecosystem.config.js

# Crear archivo de compresión
PACKAGE_NAME="crm-whatsapp-ai-deployment-$(date +%Y%m%d_%H%M%S).tar.gz"

echo "📦 Comprimiendo archivos..."

# Comprimir todo el directorio excluyendo archivos temporales
tar -czf "../$PACKAGE_NAME" \
    --exclude='*.log' \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.env' \
    --exclude='temp' \
    .

echo "✅ Paquete creado: $PACKAGE_NAME"
echo ""
echo "📋 Contenido del paquete:"
echo "   ├── backend/              # Servidor Express + API"
echo "   ├── frontend/             # Cliente React + Vite"  
echo "   ├── shared/               # Esquemas compartidos"
echo "   ├── docs/                 # Documentación completa"
echo "   ├── ecosystem.config.js   # Configuración PM2"
echo "   └── README.md             # Guía de inicio rápido"
echo ""
echo "🔧 Próximos pasos:"
echo "1. Extraer en servidor: tar -xzf $PACKAGE_NAME"
echo "2. Seguir guía: docs/DEPLOYMENT_GUIDE.md"
echo "3. Configurar variables de entorno"
echo "4. Instalar dependencias: npm install en backend/ y frontend/"
echo "5. Configurar base de datos PostgreSQL"
echo "6. Desplegar con PM2: pm2 start ecosystem.config.js"
echo ""
echo "📞 El sistema incluye:"
echo "   ✓ Respuestas automáticas inteligentes"
echo "   ✓ Integración con múltiples proveedores de IA"
echo "   ✓ Gestión de múltiples cuentas WhatsApp"
echo "   ✓ Dashboard web en tiempo real"
echo "   ✓ Configuración completa para producción"
echo ""
echo "🎉 Paquete de despliegue listo para usar!"