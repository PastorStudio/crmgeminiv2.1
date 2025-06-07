# Guía para Activar Always On en Replit

## 🔄 Activar Always On (Recomendado)

### Método 1: Desde la Interfaz de Replit
1. **Ve a tu Repl** y haz clic en el botón de configuración (⚙️)
2. **Busca la sección "Always On"** en el panel lateral
3. **Activa el toggle "Always On"**
4. **Confirma la suscripción** si aparece el prompt de pago

### Método 2: Desde el Panel de Control
1. **Ve a tu dashboard** de Replit
2. **Selecciona tu Repl** del CRM WhatsApp
3. **Haz clic en "Settings"** o "Configuración"
4. **Busca "Deployment"** o "Always On"
5. **Activa la función**

## 💡 Alternativas sin Always On

### Uso de UptimeRobot (Gratis)
Si no tienes Always On, puedes usar un servicio de monitoreo externo:

1. **Regístrate en UptimeRobot** (https://uptimerobot.com)
2. **Crea un nuevo monitor** con estos datos:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://tu-repl-url.replit.app/api/health`
   - **Monitoring Interval**: 5 minutos
   - **Keyword**: `healthy`

### Configuración de Ping Automático
```bash
# Script para mantener el Repl activo (solo si no tienes Always On)
# Crear en un servidor externo o usar GitHub Actions

curl -s "https://tu-repl-url.replit.app/api/health" > /dev/null
```

## 🔧 Optimización para Always On

### Variables de Entorno Requeridas
```bash
# En Secrets de Replit, agregar:
DATABASE_URL=tu_database_url_aqui
GEMINI_API_KEY=tu_clave_gemini
OPENAI_API_KEY=tu_clave_openai
QWEN_API_KEY=tu_clave_qwen
NODE_ENV=production
```

### Script de Auto-Reinicio
```bash
# Crear archivo .replit para configuración automática
run = "npm run dev"
modules = ["nodejs-20"]

[deployment]
run = ["sh", "-c", "npm run dev"]

[env]
NODE_ENV = "production"
```

## 📊 Monitoreo del Sistema

### Health Check Endpoint
Tu aplicación ya tiene configurado un endpoint de salud en:
```
https://tu-repl-url.replit.app/api/health
```

### Verificación Manual
```bash
# Verificar estado de la aplicación
curl https://tu-repl-url.replit.app/api/health

# Respuesta esperada:
{
  "status": "healthy",
  "timestamp": "2025-06-07T...",
  "uptime": 1234.56,
  "memory": {...},
  "database": "connected",
  "whatsapp": {...},
  "version": "1.0.0"
}
```

## 🚨 Solución de Problemas

### Si el Repl se Detiene
1. **Verificar los logs** en la consola de Replit
2. **Revisar el uso de recursos** (CPU/RAM)
3. **Comprobar las variables de entorno**
4. **Reiniciar manualmente** si es necesario

### Límites de Replit
- **CPU**: Limitado en planes gratuitos
- **RAM**: 512MB-1GB según el plan
- **Almacenamiento**: Limitado
- **Tráfico**: Según el plan

### Optimizaciones
```bash
# En package.json, optimizar el comando de inicio:
{
  "scripts": {
    "dev": "NODE_OPTIONS='--max-old-space-size=512' tsx server/index.ts",
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

## 💰 Costos de Always On

### Replit Hacker Plan
- **Costo**: ~$7/mes
- **Incluye**: Always On, más recursos, dominios personalizados
- **Beneficios**: Ideal para aplicaciones en producción

### Replit Pro Plan  
- **Costo**: ~$20/mes
- **Incluye**: Más recursos, colaboración avanzada
- **Beneficios**: Para equipos y aplicaciones críticas

## 🔄 Configuración Automática

### Script de Verificación de Estado
```javascript
// health-monitor.js - Para ejecutar externamente
const https = require('https');

function checkHealth() {
  const url = 'https://tu-repl-url.replit.app/api/health';
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const health = JSON.parse(data);
        if (health.status === 'healthy') {
          console.log('✅ Sistema funcionando correctamente');
        } else {
          console.log('⚠️ Sistema con problemas:', health);
        }
      } catch (e) {
        console.log('❌ Error al verificar estado:', e.message);
      }
    });
  }).on('error', (e) => {
    console.log('❌ Error de conexión:', e.message);
  });
}

// Ejecutar cada 5 minutos
setInterval(checkHealth, 5 * 60 * 1000);
checkHealth(); // Ejecutar inmediatamente
```

## 📱 Configuración de Notificaciones

### Discord/Slack Webhook (Opcional)
```javascript
// notification.js - Agregar al health check
const webhook = 'tu_webhook_url_aqui';

function sendAlert(message) {
  const payload = {
    content: `🚨 CRM WhatsApp Alert: ${message}`
  };
  
  fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// Usar en caso de errores críticos
```

## ✅ Checklist de Configuración

- [ ] Always On activado en Replit
- [ ] Variables de entorno configuradas
- [ ] Health check funcionando
- [ ] UptimeRobot configurado (backup)
- [ ] Logs de monitoreo activados
- [ ] Notificaciones configuradas (opcional)

## 🎯 Recomendación Final

**Para uso en producción:**
1. Activa Always On en Replit ($7/mes)
2. Configura UptimeRobot como backup
3. Monitorea regularmente los logs
4. Mantén las APIs keys actualizadas

Tu sistema ya está optimizado para funcionar 24/7. Solo necesitas activar Always On para garantizar disponibilidad continua.