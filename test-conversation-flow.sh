#!/bin/bash

echo "🧪 Probando flujo de conversación inteligente..."

# Test 1: Saludo inicial
echo "📝 Test 1: Saludo inicial"
response1=$(curl -s -X POST http://localhost:5000/api/intelligent/process-message \
  -H "Content-Type: application/json" \
  -d '{"accountId": 1, "chatId": "+1234567890", "message": "Hola, buenos días", "fromNumber": "+1234567890"}')

if echo "$response1" | grep -q '"success":true'; then
  echo "✅ Saludo procesado correctamente"
  echo "$response1" | jq -r '.response.message // "Sin respuesta"' 2>/dev/null
else
  echo "❌ Error en saludo: $response1"
fi

sleep 2

# Test 2: Consulta de información
echo -e "\n📝 Test 2: Consulta de información"
response2=$(curl -s -X POST http://localhost:5000/api/intelligent/process-message \
  -H "Content-Type: application/json" \
  -d '{"accountId": 1, "chatId": "+1234567890", "message": "Necesito información sobre sus precios", "fromNumber": "+1234567890"}')

if echo "$response2" | grep -q '"success":true'; then
  echo "✅ Consulta procesada correctamente"
  echo "$response2" | jq -r '.response.message // "Sin respuesta"' 2>/dev/null
else
  echo "❌ Error en consulta: $response2"
fi

sleep 2

# Test 3: Despedida
echo -e "\n📝 Test 3: Despedida"
response3=$(curl -s -X POST http://localhost:5000/api/intelligent/process-message \
  -H "Content-Type: application/json" \
  -d '{"accountId": 1, "chatId": "+1234567890", "message": "Muchas gracias, que tengas buen día", "fromNumber": "+1234567890"}')

if echo "$response3" | grep -q '"success":true'; then
  echo "✅ Despedida procesada correctamente"
  echo "$response3" | jq -r '.response.message // "Sin respuesta"' 2>/dev/null
else
  echo "❌ Error en despedida: $response3"
fi

echo -e "\n📊 Pruebas de flujo de conversación completadas"