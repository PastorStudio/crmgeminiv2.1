# Guía de Despliegue en Hostinger - WhatsApp CRM

## 📋 Requisitos de Hostinger

### Plan Recomendado
- **Business Hosting** o superior
- **Node.js** habilitado (v18+)
- **PostgreSQL** incluido
- **SSH Access** para configuración
- **SSL Certificate** automático

## 🚀 Proceso de Despliegue

### Paso 1: Preparar Archivos para Hostinger

```bash
# Crear paquete de despliegue
tar -czf whatsapp-crm-hostinger.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=mobile-app/node_modules \
  client/ server/ shared/ package.json \
  vite.config.ts tsconfig.json tailwind.config.ts \
  postcss.config.js drizzle.config.ts \
  mobile-app/
```

### Paso 2: Configurar Base de Datos PostgreSQL

En el panel de Hostinger:
1. **Crear base de datos PostgreSQL**
2. **Anotar credenciales**:
   - Host: localhost (generalmente)
   - Puerto: 5432
   - Nombre de BD: tu_db_name
   - Usuario: tu_usuario
   - Contraseña: tu_password

### Paso 3: Variables de Entorno

Crear archivo `.env` en el servidor:
```env
# Base de datos Hostinger
DATABASE_URL=postgresql://usuario:password@localhost:5432/nombre_bd
PGHOST=localhost
PGPORT=5432
PGUSER=tu_usuario
PGPASSWORD=tu_password
PGDATABASE=nombre_bd

# Configuración del servidor
PORT=3000
NODE_ENV=production

# APIs (opcional)
OPENAI_API_KEY=tu_clave_openai
GEMINI_API_KEY=tu_clave_gemini
```

### Paso 4: Comandos de Instalación

```bash
# Conectar por SSH a Hostinger
ssh usuario@tu-dominio.com

# Navegar al directorio público
cd public_html

# Extraer archivos
tar -xzf whatsapp-crm-hostinger.tar.gz

# Instalar dependencias
npm install --production

# Configurar base de datos
npm run db:push

# Construir aplicación
npm run build
```

### Paso 5: Configuración Node.js en Hostinger

En el panel de control:
1. **Ir a Node.js App**
2. **Crear nueva aplicación**
3. **Configurar**:
   - Versión Node.js: 18.x o superior
   - Directorio de aplicación: public_html
   - Archivo de inicio: server/index.js
   - Dominio: tu-dominio.com

## 🔧 Configuración de Producción

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node server/index.js",
    "build": "vite build",
    "db:push": "drizzle-kit push:pg",
    "production": "NODE_ENV=production npm start"
  }
}
```

### Configuración del Servidor (server/index.js)
```javascript
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '../dist')));

// Rutas API
app.use('/api', require('./routes'));

// Servir aplicación React
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
```

## 📱 Configuración Mobile App

### Actualizar IP del Servidor
En `mobile-app/src/services/ApiService.js`:
```javascript
const BASE_URL = 'https://tu-dominio.com';
```

### Regenerar APK
```bash
cd mobile-app
npm run build:android-apk
```

## 🔒 Configuración SSL y Dominio

### SSL Automático
Hostinger activa SSL automáticamente. Verificar en:
- Panel de Control → SSL
- Forzar HTTPS activado

### Configurar Dominio
1. **Apuntar dominio** a Hostinger
2. **Verificar DNS** propagado
3. **Probar** https://tu-dominio.com

## 📊 Monitoreo y Logs

### Ver Logs de la Aplicación
```bash
# SSH al servidor
tail -f logs/app.log

# Ver logs de Node.js
tail -f tmp/nodejs.log
```

### Verificar Estado
```bash
# Verificar proceso Node.js
ps aux | grep node

# Verificar puerto
netstat -tulpn | grep :3000
```

## 🚨 Solución de Problemas

### Error: "Cannot find module"
```bash
# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install --production
```

### Error: "Database connection failed"
1. Verificar credenciales en `.env`
2. Confirmar que PostgreSQL está activo
3. Comprobar firewall/permisos

### Error: "Port already in use"
```bash
# Encontrar proceso en puerto
lsof -i :3000
# Terminar proceso
kill -9 PID_NUMBER
```

### App no carga en el navegador
1. Verificar que `npm run build` se ejecutó
2. Confirmar archivos en `/dist`
3. Revisar configuración SSL

## ⚡ Optimizaciones para Producción

### Compresión
```javascript
const compression = require('compression');
app.use(compression());
```

### Cache Headers
```javascript
app.use(express.static('dist', {
  maxAge: '1y',
  etag: false
}));
```

### PM2 para Gestión de Procesos
```bash
npm install -g pm2
pm2 start server/index.js --name "whatsapp-crm"
pm2 startup
pm2 save
```

## 📈 Escalabilidad

### Para Alto Tráfico
- Upgrade a VPS Hostinger
- Implementar Redis para sesiones
- CDN para archivos estáticos
- Load balancer si es necesario

## 🔄 Actualizaciones

### Proceso de Actualización
```bash
# Backup base de datos
pg_dump nombre_bd > backup_$(date +%Y%m%d).sql

# Subir nuevos archivos
scp -r dist/ usuario@servidor:/public_html/

# Reiniciar aplicación
pm2 restart whatsapp-crm
```

Su sistema WhatsApp CRM estará completamente funcional en Hostinger con esta configuración.