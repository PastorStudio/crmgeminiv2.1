# Sistema de Intervenciones Manuales - Guía Completa

## Descripción General

El sistema de intervenciones manuales permite pausar las respuestas automáticas por 30 minutos cuando envías un mensaje manual en una conversación. Esto garantiza que puedas tomar control total de la conversación sin que el sistema AI interfiera.

## Funcionalidades Principales

### 🔒 Aislamiento Total por Usuario
- Cada usuario solo puede ver y gestionar sus propias intervenciones
- Sistema seguro con filtrado automático por usuario
- No hay acceso cruzado entre usuarios diferentes

### ⏰ Pausa Automática de 30 Minutos
- Al enviar un mensaje manual (fromMe = true), el sistema automáticamente:
  - Registra la intervención en la base de datos
  - Pausa respuestas automáticas por 30 minutos
  - Muestra tiempo restante en tiempo real

### 🎯 Integración con Procesador Unificado
- El sistema verifica intervenciones antes de procesar mensajes
- Prioridad absoluta: Intervención > Prompt Asignado > IA Genérica
- Logging detallado para seguimiento y debugging

## API Endpoints Disponibles

### 1. Obtener Intervenciones Activas
```
GET /api/interventions/active
Headers: Authorization: Bearer {token}
```
Retorna todas las intervenciones activas del usuario autenticado.

### 2. Verificar Chat Específico
```
GET /api/interventions/check/{accountId}/{chatId}
Headers: Authorization: Bearer {token}
```
Verifica si un chat específico tiene intervención activa.

### 3. Registrar Intervención Manual
```
POST /api/interventions/register
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "accountId": 1,
  "chatId": "chat_id_here"
}
```

### 4. Finalizar Intervención
```
POST /api/interventions/end
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "accountId": 1,
  "chatId": "chat_id_here"
}
```

### 5. Estadísticas de Usuario
```
GET /api/interventions/stats
Headers: Authorization: Bearer {token}
```

## Flujo de Funcionamiento

### 1. Detección Automática
Cuando envías un mensaje manual en WhatsApp:
```
Usuario envía mensaje → fromMe = true → Sistema registra intervención → Chat pausado 30 min
```

### 2. Verificación de Mensajes Entrantes
Para cada mensaje que llega:
```
Mensaje entrante → ¿Hay intervención activa? → 
  SI: Bloquear respuesta automática
  NO: Continuar con procesamiento normal
```

### 3. Expiración Automática
```
Cada 5 minutos → Limpiar intervenciones expiradas → Reactivar respuestas automáticas
```

## Seguridad y Privacidad

### Aislamiento por Usuario
- Todas las consultas incluyen filtrado automático por `user_id`
- Usuario A no puede ver/modificar intervenciones de Usuario B
- Verificación de pertenencia de cuentas WhatsApp por usuario

### Validación de Acceso
```sql
-- Ejemplo de consulta segura
SELECT * FROM chat_interventions ci
JOIN whatsapp_accounts wa ON ci.account_id = wa.id
WHERE ci.user_id = ? AND wa.user_id = ?
```

## Monitoreo y Logging

### Logs del Sistema
```
🔒 Intervención manual registrada - Chat {chatId} pausado por 30 minutos
🔒 Chat {chatId} en pausa por intervención - {X} minutos restantes
🧹 {X} intervenciones expiradas limpiadas
```

### Verificación de Estado
```sql
-- Ver intervenciones activas por usuario
SELECT ci.*, wa.name as account_name,
       EXTRACT(MINUTES FROM (ci.pause_until - NOW())) as remaining_minutes
FROM chat_interventions ci
JOIN whatsapp_accounts wa ON ci.account_id = wa.id
WHERE ci.user_id = ? AND ci.is_active = true;
```

## Configuración Actual

### Base de Datos
- Tabla: `chat_interventions`
- Campos principales:
  - `id`: Identificador único
  - `user_id`: ID del usuario (aislamiento)
  - `account_id`: Cuenta WhatsApp
  - `chat_id`: Chat específico
  - `pause_until`: Hasta cuándo está pausado
  - `is_active`: Estado activo/inactivo

### Integración con Prompt System
- **Cuenta 1**: Medical Assistant (Prompt 8)
- **Cuenta 2**: Sales Agent CRM (Prompt 9)
- **Cuenta 3**: Sales Agent CRM (Prompt 9)
- **Cuenta 4**: CRM Support - Zoe (Prompt 7)

## Uso Práctico

### Escenario Típico
1. Cliente envía mensaje a tu WhatsApp Business
2. Sistema AI responde automáticamente con prompt asignado
3. **TÚ decides intervenir manualmente**
4. Envías mensaje manual → Sistema pausa respuestas 30 min
5. Puedes conversar libremente sin interferencia del AI
6. Después de 30 min, respuestas automáticas se reactivan

### Ventajas
- Control total cuando lo necesites
- No interrumpe flujo normal de automatización
- Seguridad y privacidad total por usuario
- Logging completo para auditoría
- Integración transparente con sistema existente

## Estado Actual del Sistema

✅ **Sistema Completamente Implementado y Funcional**
- Intervenciones registradas correctamente
- API endpoints respondiendo
- Integración con procesador unificado
- Limpieza automática de intervenciones expiradas
- Logging y monitoreo activo
- Seguridad por usuario implementada

El sistema está listo para uso en producción y garantiza que tengas control total sobre tus conversaciones cuando lo necesites, manteniendo la automatización eficiente en todos los demás casos.