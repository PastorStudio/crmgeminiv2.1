#!/bin/bash

# Colores para salida
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Configuración de Gemini API para servidor de producción${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""

echo -e "Este script te ayudará a configurar correctamente la clave API de servidor para Gemini."
echo -e "Para usar Gemini en un servidor, necesitarás una clave API de Vertex AI."
echo ""

echo -e "${YELLOW}Instrucciones:${NC}"
echo "1. Ve a la Consola de Google Cloud (https://console.cloud.google.com/)"
echo "2. Crea un nuevo proyecto o selecciona uno existente"
echo "3. Activa la facturación (requerido para usar Vertex AI API)"
echo "4. Habilita la API de Vertex AI"
echo "5. Crea una cuenta de servicio en 'IAM & Admin > Service Accounts'"
echo "6. Asigna el rol 'Vertex AI User' a esta cuenta"
echo "7. Crea una clave JSON para esta cuenta de servicio"
echo "8. Descarga el archivo JSON"
echo ""

echo -e "¿Tienes el archivo JSON de credenciales? (s/n)"
read response

if [ "$response" = "s" ]; then
  echo "Por favor, introduce la ruta al archivo JSON de credenciales:"
  read json_path
  
  if [ -f "$json_path" ]; then
    # Extraer información del archivo JSON
    project_id=$(grep -o '"project_id": "[^"]*' $json_path | cut -d'"' -f4)
    
    if [ -n "$project_id" ]; then
      # Configurar variables de entorno
      echo "Agregando la configuración al archivo .env..."
      
      # Comprobar si ya existe GEMINI_API_KEY en .env
      if grep -q "GEMINI_API_KEY" .env; then
        # Reemplazar la línea existente
        sed -i '/GEMINI_API_KEY/d' .env
      fi
      
      # Copiar el archivo JSON a una ubicación segura
      mkdir -p ./config
      cp "$json_path" "./config/google-credentials.json"
      
      # Añadir configuración al archivo .env
      echo "GOOGLE_APPLICATION_CREDENTIALS=./config/google-credentials.json" >> .env
      echo "GEMINI_API_KEY=vertex_ai:$project_id" >> .env
      echo "GEMINI_USE_VERTEX=true" >> .env
      
      echo -e "${GREEN}¡Configuración completada!${NC}"
      echo "La aplicación ahora usará la API de Vertex AI para Gemini."
      echo ""
      echo "NOTA: Asegúrate de incluir el directorio 'config' en .gitignore para no subir tus credenciales a GitHub."
    else
      echo -e "${RED}No se pudo extraer el project_id del archivo JSON.${NC}"
    fi
  else
    echo -e "${RED}El archivo especificado no existe.${NC}"
  fi
else
  echo -e "${YELLOW}Por favor, obtén el archivo de credenciales desde la consola de Google Cloud antes de continuar.${NC}"
  echo "Puedes ejecutar este script nuevamente cuando tengas el archivo."
fi