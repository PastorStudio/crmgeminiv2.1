# Sistema CRM WhatsApp con IA - Guía de Despliegue

## Resumen Técnico
Sistema completo de CRM con integración WhatsApp y múltiples proveedores de IA (Gemini, OpenAI, DeepSeek).

**Stack:** Node.js + TypeScript + React + PostgreSQL

## 🚀 Despliegue Rápido en EasyPanel

### 1. Preparar Base de Datos PostgreSQL
- Crear cuenta en [Neon.tech](https://neon.tech) (gratuito)
- Crear nueva base de datos
- Copiar URL de conexión

### 2. Obtener API Key de Gemini (Gratuito)
- Ir a [Google AI Studio](https://makersuite.google.com/app/apikey)
- Crear API key
- Copiar la clave

### 3. Subir a GitHub
```bash
git init
git add .
git commit -m "Deploy ready"
git remote add origin https://github.com/tu-usuario/tu-repo.git
git push -u origin main
```

### 4. Configurar en EasyPanel
1. Crear nueva aplicación
2. Conectar repositorio GitHub
3. Configurar variables de entorno:
   - `DATABASE_URL`: URL de Neon
   - `GEMINI_API_KEY`: Tu API key
   - `NODE_ENV`: production
   - `PORT`: 3000

4. Configurar build:
   - Build Command: `npm run build`
   - Start Command: `npm start`

### 5. Inicializar Base de Datos
Después del primer despliegue, ejecutar en la consola:
```bash
npm run db:push
```

## 🎯 URLs Post-Despliegue
- Dashboard: `https://tu-app.easypanel.host/`
- API Health: `https://tu-app.easypanel.host/api/health`
- WhatsApp QR: Se genera automáticamente en el dashboard

## 💰 Costos Estimados
- **Neon PostgreSQL**: Gratis (512MB)
- **Gemini API**: Gratis (60 req/min)
- **EasyPanel**: $5-10/mes
- **Total**: ~$5-10/mes

## 🔧 Características del Sistema

### Integración WhatsApp
- Conexión vía WhatsApp Web
- Generación automática de QR
- Gestión de múltiples cuentas
- Respuestas automáticas con IA

### IA Multi-Proveedor
- **Gemini** (Google AI) - Principal y gratuito
- **OpenAI** - Opcional con fallback
- **DeepSeek** - Opcional con fallback

### Gestión de Datos
- **Contactos**: Información centralizada
- **Leads**: Pipeline de ventas completo
- **Mensajes**: Historial completo de conversaciones
- **Tickets**: Sistema de soporte

### Dashboard Completo
- Métricas en tiempo real
- Gestión de conversaciones
- Configuración de respuestas automáticas
- Administración de cuentas WhatsApp

## 🆘 Solución de Problemas

### "Cannot connect to database"
Verificar que `DATABASE_URL` esté correcta en las variables de entorno.

### "WhatsApp client not ready"
Normal al inicio. Escanear QR code desde el dashboard.

### "Build failed"
Verificar que todas las dependencias estén en `package.json`.

## 📞 Soporte
Para problemas técnicos, revisar los logs en EasyPanel o contactar soporte.

¿Todo listo para el despliegue?