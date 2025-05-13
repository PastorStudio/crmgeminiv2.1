#!/bin/bash

# Script para inicializar y migrar la base de datos
echo "Iniciando migración e inicialización de la base de datos..."
NODE_ENV=development tsx server/scripts/dbInit.ts

if [ $? -eq 0 ]; then
  echo "✅ Base de datos inicializada correctamente."
else
  echo "❌ Error al inicializar la base de datos."
  exit 1
fi