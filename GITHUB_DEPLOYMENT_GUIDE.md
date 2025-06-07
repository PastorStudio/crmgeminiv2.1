# GitHub Deployment Configuration Guide

## Información del Repositorio para Deployment

### Configuración Básica
- **Rama Principal**: `main`
- **Ruta de Compilación**: `/` (raíz del proyecto)
- **Comando de Build**: `npm run build`
- **Directorio de Salida**: `dist/` (para frontend) + servidor Node.js
- **Puerto**: `3000`

### URLs del Repositorio GitHub
```
URL HTTPS: https://github.com/tu-usuario/crm-whatsapp-ai.git
URL SSH: git@github.com:tu-usuario/crm-whatsapp-ai.git
```

## Para Configurar en Plataformas de Deployment

### 1. Vercel Deployment
```yaml
Configuración:
- Framework: Other
- Build Command: npm run build
- Output Directory: dist
- Install Command: npm install
- Development Command: npm run dev
- Root Directory: /
```

### 2. Netlify Deployment
```yaml
Configuración:
- Build Command: npm run build
- Publish Directory: dist
- Production Branch: main
- Base Directory: /
```

### 3. Railway Deployment
```yaml
Configuración:
- Source: GitHub Repository
- Branch: main
- Build Command: npm run build
- Start Command: npm start
- Port: 3000
```

### 4. Render Deployment
```yaml
Configuración:
- Repository: https://github.com/tu-usuario/crm-whatsapp-ai
- Branch: main
- Build Command: npm run build
- Start Command: npm start
- Environment: Node
```

### 5. DigitalOcean App Platform
```yaml
Configuración:
- Source Type: GitHub
- Repository: crm-whatsapp-ai
- Branch: main
- Build Command: npm run build
- Run Command: npm start
```

## Variables de Entorno Requeridas

### Para Todas las Plataformas:
```env
# Base de Datos
DATABASE_URL=postgresql://user:pass@host:5432/db
POSTGRES_PASSWORD=tu_password_seguro

# Claves API de IA
OPENAI_API_KEY=sk-tu_clave_openai
GEMINI_API_KEY=tu_clave_gemini
ANTHROPIC_API_KEY=tu_clave_anthropic

# Seguridad
JWT_SECRET=tu_jwt_secret_minimo_32_caracteres
SESSION_SECRET=tu_session_secret_minimo_32_caracteres

# Configuración de Aplicación
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://tu-dominio.com
API_BASE_URL=https://tu-dominio.com
```

## Comandos de Package.json

El proyecto incluye estos comandos esenciales:
```json
{
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "tsc && vite build",
    "start": "node dist/server/index.js",
    "preview": "vite preview",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

## Dockerfile para Container Deployment

Si prefieres deployment con contenedores:
```dockerfile
# Ubicación: ./Dockerfile (ya incluido en el proyecto)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## GitHub Actions Configuration

El archivo `.github/workflows/deploy.yml` está configurado para:
- **Trigger**: Push a rama `main`
- **Testing**: Ejecuta pruebas automáticamente
- **Build**: Construye la aplicación
- **Deploy**: Despliega automáticamente

## Pasos para Conectar con GitHub

### 1. Crear Repositorio en GitHub
```bash
# En GitHub, crear nuevo repositorio llamado "crm-whatsapp-ai"
```

### 2. Conectar Proyecto Local
```bash
git remote add origin https://github.com/tu-usuario/crm-whatsapp-ai.git
git branch -M main
git push -u origin main
```

### 3. Configurar Secrets en GitHub
En tu repositorio de GitHub, ve a:
`Settings > Secrets and variables > Actions`

Agregar estos secrets:
- `OPENAI_API_KEY`
- `DATABASE_URL`
- `JWT_SECRET`
- `SESSION_SECRET`
- `POSTGRES_PASSWORD`

## URLs de Ejemplo para Deployment

### Para EasyPanel:
```yaml
Repository URL: https://github.com/tu-usuario/crm-whatsapp-ai
Branch: main
Build Path: /
```

### Para Heroku:
```bash
heroku create crm-whatsapp-ai
git push heroku main
```

### Para Railway:
```yaml
Source: GitHub
Repository: tu-usuario/crm-whatsapp-ai
Branch: main
```

## Configuración de Base de Datos

### PostgreSQL Cloud (Recomendado):
- **Neon**: https://neon.tech
- **Supabase**: https://supabase.com
- **PlanetScale**: https://planetscale.com
- **Railway PostgreSQL**: Automático con Railway

### Configuración Automática:
El archivo `init.sql` se ejecuta automáticamente para crear:
- Todas las tablas necesarias
- Datos iniciales
- Usuarios por defecto (admin/admin123)

## Health Check Endpoints

Para monitoreo de deployment:
- **Health Check**: `GET /api/health`
- **Status**: `GET /api/status`
- **Version**: `GET /api/version`

## Comandos Post-Deployment

Después del deployment, ejecutar:
```bash
# Ejecutar migraciones de base de datos
npm run db:push

# Verificar estado de la aplicación
curl https://tu-dominio.com/api/health
```

## Troubleshooting Common Issues

### Error de Build:
- Verificar que todas las dependencias estén en `package.json`
- Asegurar que `NODE_VERSION` sea 18 o superior

### Error de Base de Datos:
- Verificar `DATABASE_URL` en variables de entorno
- Asegurar que PostgreSQL esté disponible

### Error de Autenticación:
- Verificar que todas las API keys estén configuradas
- Revisar que `JWT_SECRET` tenga al menos 32 caracteres

Esta configuración te permite desplegar en cualquier plataforma moderna que soporte Node.js y PostgreSQL.