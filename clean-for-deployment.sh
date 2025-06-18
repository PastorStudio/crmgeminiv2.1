#!/bin/bash

echo "🧹 Iniciando limpieza del proyecto para despliegue..."

# Crear directorio de despliegue
mkdir -p deployment-clean

# Copiar archivos esenciales
echo "📁 Copiando archivos esenciales..."

# Directorios principales
cp -r client deployment-clean/
cp -r server deployment-clean/
cp -r shared deployment-clean/

# Archivos de configuración
cp package.json deployment-clean/
cp drizzle.config.ts deployment-clean/
cp vite.config.ts deployment-clean/
cp tailwind.config.ts deployment-clean/
cp tsconfig.json deployment-clean/
cp postcss.config.js deployment-clean/
cp .env.example deployment-clean/

# Documentación
cp DEPLOYMENT_GUIDE.md deployment-clean/
cp README.md deployment-clean/ 2>/dev/null || echo "README.md no encontrado, continuando..."

echo "🗑️ Eliminando archivos innecesarios del directorio de despliegue..."

cd deployment-clean

# Eliminar archivos de test y desarrollo
find . -name "test-*.js" -delete
find . -name "*-test.js" -delete
find . -name "*.test.ts" -delete

# Eliminar scripts de microservicios
rm -f run-microservices*.js
rm -f start-microservices.js
rm -f server-microservices.js

# Eliminar instaladores y scripts de sistema
rm -f install-wizard.sh
rm -f production-optimization.sh
rm -f ecosystem.config.js

# Eliminar configuraciones específicas de Replit
rm -f .replit
rm -f replit.nix

# Eliminar archivos de backup
find . -name "*.bak" -delete
find . -name "*_backup.*" -delete

# Eliminar archivos de logs temporales
find . -name "*.log" -delete

# Eliminar directorios de dependencias
rm -rf node_modules

cd ..

echo "✅ Limpieza completada!"
echo "📦 Proyecto limpio disponible en: ./deployment-clean/"
echo ""
echo "🚀 Pasos siguientes:"
echo "1. cd deployment-clean"
echo "2. Configurar .env con tus variables"
echo "3. Subir a tu repositorio Git"
echo "4. Desplegar en EasyPanel"
echo ""
echo "📊 Tamaño del proyecto:"
du -sh deployment-clean