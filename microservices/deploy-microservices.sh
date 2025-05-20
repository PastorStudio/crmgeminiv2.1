#!/bin/bash

# Script para desplegar todos los microservicios
# Ejecutar: bash microservices/deploy-microservices.sh

echo "🚀 Desplegando microservicios v1.0"
echo "=================================="

# Crear directorios necesarios
mkdir -p microservices/logs

# Configuración
export DATABASE_SERVER_PORT=5003
export PROCESSOR_SERVER_PORT=5002
export WHATSAPP_SERVER_PORT=5001
export API_SERVER_PORT=5000
export NODE_ENV=development

# Verificar base de datos
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: La variable DATABASE_URL no está configurada"
    echo "Por favor, ejecuta: export DATABASE_URL=tu_url_de_conexion"
    exit 1
fi

echo "✅ Variables de entorno configuradas"

# Iniciar servidores en orden
echo "📊 Iniciando servidor de base de datos..."
node microservices/database-server/index.js > microservices/logs/database-server.log 2>&1 &
DB_PID=$!
echo "   Servidor de base de datos iniciado en http://localhost:$DATABASE_SERVER_PORT (PID: $DB_PID)"
sleep 3

echo "🧠 Iniciando servidor de procesamiento..."
node microservices/message-processor/index.js > microservices/logs/message-processor.log 2>&1 &
PROCESSOR_PID=$!
echo "   Servidor de procesamiento iniciado en http://localhost:$PROCESSOR_SERVER_PORT (PID: $PROCESSOR_PID)"
sleep 2

echo "📱 Iniciando servidor de WhatsApp..."
node microservices/whatsapp-server/index.js > microservices/logs/whatsapp-server.log 2>&1 &
WHATSAPP_PID=$!
echo "   Servidor de WhatsApp iniciado en http://localhost:$WHATSAPP_SERVER_PORT (PID: $WHATSAPP_PID)"
sleep 2

echo "🌐 Iniciando servidor API..."
node microservices/api-server/index.js > microservices/logs/api-server.log 2>&1 &
API_PID=$!
echo "   Servidor API iniciado en http://localhost:$API_SERVER_PORT (PID: $API_PID)"

echo ""
echo "✅ Todos los microservicios iniciados!"
echo "  - API Server:        http://localhost:$API_SERVER_PORT"
echo "  - WhatsApp Server:   http://localhost:$WHATSAPP_SERVER_PORT"
echo "  - Processor Server:  http://localhost:$PROCESSOR_SERVER_PORT"
echo "  - Database Server:   http://localhost:$DATABASE_SERVER_PORT"
echo ""
echo "📝 Los logs están disponibles en microservices/logs/"
echo "  - Para ver los logs: tail -f microservices/logs/api-server.log"
echo ""
echo "⚠️ Para detener los microservicios, ejecuta:"
echo "  kill $API_PID $WHATSAPP_PID $PROCESSOR_PID $DB_PID"

# Guardar PIDs para futura referencia
echo "$API_PID $WHATSAPP_PID $PROCESSOR_PID $DB_PID" > microservices/pids.txt
echo ""
echo "Los PIDs se han guardado en microservices/pids.txt"
echo "Para detener los servicios, ejecuta: kill \$(cat microservices/pids.txt)"