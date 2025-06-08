#!/bin/bash

# Script para generar APK de WhatsApp CRM Mobile
# Este script automatiza el proceso de construcción del APK

echo "🚀 Iniciando construcción de APK para WhatsApp CRM Mobile"
echo "=============================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecutar este script desde la carpeta mobile-app"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js no está instalado"
    echo "   Descargar desde: https://nodejs.org/"
    exit 1
fi

# Verificar Expo CLI
if ! command -v expo &> /dev/null; then
    echo "📦 Instalando Expo CLI..."
    npm install -g @expo/cli
fi

# Verificar EAS CLI
if ! command -v eas &> /dev/null; then
    echo "📦 Instalando EAS CLI..."
    npm install -g eas-cli
fi

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Preparar assets
echo "🎨 Preparando assets..."
npm run prepare-assets

# Verificar login en Expo
echo "🔐 Verificando autenticación con Expo..."
if ! eas whoami &> /dev/null; then
    echo "⚠️  Necesitas iniciar sesión en Expo"
    echo "   Ejecutar: eas login"
    echo "   O crear cuenta gratuita en: https://expo.dev"
    exit 1
fi

# Configurar build si es primera vez
if [ ! -f "eas.json" ]; then
    echo "⚙️  Configurando EAS Build por primera vez..."
    eas build:configure
fi

echo ""
echo "¿Qué tipo de APK quieres generar?"
echo "1) APK de desarrollo (rápido, 10-15 min)"
echo "2) APK de producción (optimizado, 15-20 min)"
echo ""
read -p "Selecciona opción (1 o 2): " choice

case $choice in
    1)
        echo "🔨 Generando APK de desarrollo..."
        npm run build:android-apk
        ;;
    2)
        echo "🔨 Generando APK de producción..."
        npm run build:android-production-apk
        ;;
    *)
        echo "❌ Opción inválida. Ejecutar el script de nuevo."
        exit 1
        ;;
esac

echo ""
echo "✅ Proceso iniciado!"
echo "📧 Recibirás un email cuando el APK esté listo"
echo "🔗 También puedes revisar el progreso en: https://expo.dev"
echo ""
echo "📱 Cuando esté listo:"
echo "   1. Descargar el APK desde el enlace"
echo "   2. Transferir al dispositivo Android" 
echo "   3. Instalar permitiendo 'Fuentes desconocidas'"
echo ""
echo "📋 Ver guía completa: APK_INSTALLATION_GUIDE.md"