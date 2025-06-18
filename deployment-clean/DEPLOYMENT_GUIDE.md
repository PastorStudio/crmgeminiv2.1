# Guía de Despliegue - Sistema CRM WhatsApp IA

## 📋 Requisitos Previos

### 1. Servicios Externos Necesarios
- **Base de datos PostgreSQL externa** (ej: Neon, Supabase, AWS RDS)
- **Servidor de despliegue** (EasyPanel, VPS, etc.)
- **Claves API**:
  - Gemini API Key (Google AI)
  - OpenAI API Key (opcional)
  - DeepSeek API Key (opcional)

### 2. Herramientas Locales
- Node.js 18+ 
- Git
- Editor de código (VS Code recomendado)

## 🗂️ Archivos Esenciales para Despliegue

### Estructura Mínima del Proyecto:
```
whatsapp-crm-system/
├── client/                 # Frontend React
├── server/                 # Backend Express + TypeScript
├── shared/                 # Esquemas y tipos compartidos
├── package.json           # Dependencias principales
├── drizzle.config.ts      # Configuración base de datos
├── vite.config.ts         # Configuración del bundler
├── tailwind.config.ts     # Estilos
├── tsconfig.json          # TypeScript config
├── .env.example           # Variables de entorno ejemplo
└── Dockerfile             # Para contenedores (opcional)
```

## 🚀 Paso a Paso: Despliegue desde Cero

### Paso 1: Preparar Base de Datos PostgreSQL Externa

1. **Crear base de datos PostgreSQL**:
   - Ve a [Neon.tech](https://neon.tech) (recomendado - gratuito)
   - O usa [Supabase](https://supabase.com)
   - Crea una nueva base de datos
   - Guarda la URL de conexión (formato: `postgresql://usuario:password@host:puerto/database`)

### Paso 2: Configurar Variables de Entorno

Crea un archivo `.env` con estas variables:

```env
# Base de datos
DATABASE_URL=postgresql://tu_usuario:tu_password@tu_host:5432/tu_database

# APIs de IA (mínimo una requerida)
GEMINI_API_KEY=tu_gemini_api_key
OPENAI_API_KEY=tu_openai_api_key (opcional)
DEEPSEEK_API_KEY=tu_deepseek_api_key (opcional)

# Configuración del servidor
NODE_ENV=production
PORT=3000
```

### Paso 3: Obtener Claves API

#### Gemini API (Google AI) - GRATUITO:
1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta Google
3. Crea una nueva API key
4. Copia la clave

#### OpenAI API (opcional):
1. Ve a [OpenAI Platform](https://platform.openai.com/api-keys)
2. Crea una cuenta y añade método de pago
3. Genera una nueva API key

### Paso 4: Preparar Archivos para Despliegue

Crea estos archivos en tu proyecto:

#### `package.json` (versión limpia):
```json
{
  "name": "whatsapp-crm-system",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.30.0",
    "drizzle-kit": "^0.21.0",
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "tsx": "^4.7.1",
    "typescript": "^5.4.3",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "whatsapp-web.js": "^1.23.0",
    "qrcode": "^1.5.3"
  }
}
```

#### `Dockerfile` (para contenedores):
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependencias del sistema para WhatsApp Web
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Variables de entorno para Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar package.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Construir aplicación
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
```

### Paso 5: Despliegue en EasyPanel

1. **Preparar repositorio Git**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin tu-repositorio-github
   git push -u origin main
   ```

2. **En EasyPanel**:
   - Crear nueva aplicación
   - Conectar con tu repositorio GitHub
   - Configurar variables de entorno:
     - `DATABASE_URL`
     - `GEMINI_API_KEY`
     - `NODE_ENV=production`
     - `PORT=3000`

3. **Configuración de build**:
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Port: `3000`

### Paso 6: Inicializar Base de Datos

Después del despliegue, ejecuta:
```bash
npm run db:push
```

Esto creará todas las tablas necesarias en tu base de datos PostgreSQL.

## 🗑️ Archivos NO Necesarios para Despliegue

Puedes eliminar estos archivos/carpetas para un despliegue más limpio:

```
# Archivos de desarrollo y testing
test-*.js
*-test.js
*.test.ts
run-microservices*.js
start-microservices.js
server-microservices.js

# Instaladores y scripts de sistema
install-wizard.sh
production-optimization.sh
ecosystem.config.js

# Configuraciones específicas de desarrollo local
.replit
replit.nix

# Archivos de backup
*.bak
*_backup.ts

# Documentación de desarrollo
README-*.md
DEVELOPMENT.md

# Assets no utilizados
public/unused-assets/
```

## 🔧 Script de Limpieza

Crea este script para limpiar el proyecto:

```bash
#!/bin/bash
# clean-for-deployment.sh

# Eliminar archivos de test
rm -f test-*.js *-test.js *.test.ts

# Eliminar scripts de microservicios
rm -f run-microservices*.js start-microservices.js server-microservices.js

# Eliminar instaladores
rm -f install-wizard.sh production-optimization.sh

# Eliminar configuraciones locales
rm -f ecosystem.config.js .replit replit.nix

# Eliminar backups
rm -f *.bak *_backup.ts

# Limpiar node_modules
rm -rf node_modules

echo "✅ Proyecto limpiado para despliegue"
```

## 🚦 Verificación Post-Despliegue

1. **Verificar base de datos**: Las tablas deben crearse automáticamente
2. **Probar endpoints API**: `/api/health`, `/api/dashboard-metrics`
3. **Verificar logs**: No debe haber errores críticos
4. **Probar WhatsApp**: Generar QR y conectar cuenta

## 🆘 Solución de Problemas Comunes

### Error: "Cannot connect to database"
- Verifica que `DATABASE_URL` esté correctamente configurada
- Asegúrate que la IP del servidor esté en whitelist de la DB

### Error: "Gemini API key not found"
- Verifica que `GEMINI_API_KEY` esté configurada
- Prueba la clave en [Google AI Studio](https://makersuite.google.com)

### Error: "WhatsApp client not ready"
- Es normal al inicio, el cliente necesita autenticarse
- Escanea el código QR desde el dashboard

## 📊 Recursos y Costos Estimados

- **Base de datos Neon**: Gratuito hasta 512MB
- **Gemini API**: Gratuito hasta 60 requests/minuto
- **EasyPanel**: Desde $5/mes
- **Total estimado**: $5-15/mes para uso básico

¿Necesitas que ajuste alguna parte de esta guía o que cree algún archivo específico?