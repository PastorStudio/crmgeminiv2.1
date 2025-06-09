# Hostinger Deployment - Quick Start

## 🎯 Resumen de Despliegue

Su sistema WhatsApp CRM está listo para Hostinger con:
- Configuración automática de producción
- Scripts de despliegue optimizados
- Base de datos PostgreSQL integrada
- SSL y compresión configurados

## 🚀 Despliegue en 5 Pasos

### 1. Generar Paquete de Despliegue
```bash
./deploy-hostinger.sh
```
Esto crea `whatsapp-crm-hostinger.tar.gz` listo para subir.

### 2. Configurar Base de Datos en Hostinger
- Panel de Control → Bases de Datos → PostgreSQL
- Crear nueva base de datos
- Anotar: nombre, usuario, contraseña

### 3. Subir y Extraer Archivos
```bash
# Via SSH o File Manager
scp whatsapp-crm-hostinger.tar.gz usuario@servidor:/public_html/
ssh usuario@servidor
cd public_html
tar -xzf whatsapp-crm-hostinger.tar.gz
```

### 4. Configurar Variables de Entorno
Editar `.env.production`:
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombrebd
PGUSER=tu_usuario_db
PGPASSWORD=tu_password_db
PGDATABASE=nombre_de_tu_bd
```

### 5. Instalar y Activar
```bash
./install.sh
```

Panel Hostinger → Node.js App:
- Directorio: public_html
- Archivo inicio: server/index.js
- Versión Node.js: 18+

## 📱 Configurar App Móvil

Actualizar `mobile-app/src/services/ApiService.js`:
```javascript
const BASE_URL = 'https://tu-dominio.com';
```

Regenerar APK:
```bash
cd mobile-app
npx eas build --platform android --profile preview
```

## ✅ Verificar Funcionamiento

- Web: https://tu-dominio.com
- API: https://tu-dominio.com/api/whatsapp-accounts
- Health: https://tu-dominio.com/health

## 🔧 Solución Rápida de Problemas

**Error 500**: Revisar logs en panel Hostinger
**Base de datos**: Verificar credenciales en .env.production
**SSL**: Activar HTTPS forzado en panel

Su CRM estará funcionando completamente en Hostinger.