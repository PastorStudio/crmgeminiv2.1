# 🚀 Sistema CRM WhatsApp AI - Paquete de Despliegue

## 📋 Descripción

Sistema empresarial de CRM para WhatsApp con inteligencia artificial integrada que proporciona respuestas automáticas inteligentes, gestión de múltiples cuentas y análisis en tiempo real.

### Características Principales

- **Respuestas Automáticas Inteligentes**: Integración con OpenAI, Google Gemini y Qwen3
- **Gestión Multi-Cuenta**: Soporte para múltiples cuentas de WhatsApp
- **Interfaz Web Moderna**: Dashboard con React y TypeScript
- **Monitoreo en Tiempo Real**: WebSocket para actualizaciones instantáneas
- **Base de Datos PostgreSQL**: Almacenamiento robusto y escalable
- **Sistema Autónomo**: Funciona sin supervisión continua

---

## 📦 Contenido del Paquete

```
deployment-package/
├── backend/                    # Servidor Express + API
│   ├── services/              # Servicios de IA y WhatsApp
│   ├── middleware/            # Middleware de autenticación
│   ├── routes/                # Rutas de API
│   ├── utils/                 # Utilidades
│   ├── package.json           # Dependencias del backend
│   ├── tsconfig.json          # Configuración TypeScript
│   ├── drizzle.config.ts      # Configuración de base de datos
│   └── .env.example           # Variables de entorno de ejemplo
├── frontend/                   # Cliente React + Vite
│   ├── src/                   # Código fuente del frontend
│   ├── package.json           # Dependencias del frontend
│   ├── vite.config.ts         # Configuración de Vite
│   ├── tailwind.config.ts     # Configuración de Tailwind
│   └── .env.example           # Variables de entorno de ejemplo
├── shared/                     # Esquemas y tipos compartidos
│   └── schema.ts              # Esquema de base de datos Drizzle
└── docs/                      # Documentación
    └── DEPLOYMENT_GUIDE.md    # Guía completa de despliegue
```

---

## ⚡ Inicio Rápido

### 1. Requisitos Previos

- **Node.js** v18.0.0 o superior
- **PostgreSQL** v14.0 o superior
- **API Keys** de OpenAI, Google Gemini y/o Qwen3

### 2. Instalación Básica

```bash
# Extraer el paquete
unzip crm-whatsapp-ai-deployment.zip
cd crm-whatsapp-ai-deployment

# Configurar backend
cd backend
npm install
cp .env.example .env
# Editar .env con tus configuraciones

# Configurar frontend
cd ../frontend
npm install
cp .env.example .env
# Editar .env con la URL de tu servidor
```

### 3. Configurar Base de Datos

```sql
-- Crear base de datos PostgreSQL
CREATE DATABASE crm_whatsapp_ai;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'tu_password';
GRANT ALL PRIVILEGES ON DATABASE crm_whatsapp_ai TO crm_user;
```

```bash
# Ejecutar migraciones
cd backend
npm run db:push
```

### 4. Ejecutar en Desarrollo

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

---

## 🔑 Configuración de API Keys

### OpenAI
1. Visitar https://platform.openai.com/api-keys
2. Crear nueva API key
3. Agregar a `.env`: `OPENAI_API_KEY="sk-tu_clave_aqui"`

### Google Gemini
1. Visitar https://makersuite.google.com/app/apikey
2. Crear nueva API key
3. Agregar a `.env`: `GOOGLE_AI_API_KEY="tu_clave_aqui"`

### Qwen3 (Alibaba Cloud)
1. Visitar https://dashscope.aliyun.com/
2. Obtener API key
3. Agregar a `.env`: `QWEN_API_KEY="tu_clave_aqui"`

---

## 🚀 Despliegue en Producción

### Con PM2 (Recomendado)

```bash
# Instalar PM2
npm install -g pm2

# Compilar frontend
cd frontend
npm run build

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Con Docker (Opcional)

```bash
# Construir y ejecutar
docker-compose up -d
```

---

## 📊 Funcionalidades del Sistema

### Panel de Control
- Dashboard con métricas en tiempo real
- Gestión de cuentas de WhatsApp
- Configuración de agentes de IA
- Monitor de respuestas automáticas

### Respuestas Automáticas
- Procesamiento inteligente de mensajes
- Respuestas contextuales multilenguaje
- Configuración de prompts personalizados
- Sistema de fallback entre proveedores de IA

### Gestión de Agentes
- Agentes externos especializados
- Asignación automática por contexto
- Monitoreo de rendimiento
- Análisis de métricas

---

## 🔧 Configuración Avanzada

### Variables de Entorno del Backend

```env
DATABASE_URL="postgresql://usuario:pass@localhost:5432/db"
OPENAI_API_KEY="sk-..."
GOOGLE_AI_API_KEY="..."
QWEN_API_KEY="..."
PORT=5000
NODE_ENV=production
SESSION_SECRET="secreto_muy_seguro"
```

### Variables de Entorno del Frontend

```env
VITE_API_BASE_URL=https://tu-dominio.com
VITE_WS_URL=wss://tu-dominio.com
```

---

## 📈 Monitoreo y Mantenimiento

### Comandos Útiles

```bash
# Ver estado de procesos
pm2 list

# Ver logs en tiempo real
pm2 logs

# Reiniciar servicios
pm2 restart all

# Monitoreo de recursos
pm2 monit
```

### Respaldos

```bash
# Respaldar base de datos
pg_dump crm_whatsapp_ai > backup_$(date +%Y%m%d).sql

# Respaldar archivos
tar -czf app_backup_$(date +%Y%m%d).tar.gz /ruta/al/proyecto
```

---

## ⚠️ Solución de Problemas

### Problemas Comunes

1. **Error de conexión a base de datos**
   - Verificar que PostgreSQL esté ejecutándose
   - Comprobar credenciales en `.env`

2. **API Keys no funcionan**
   - Verificar que las claves estén correctas
   - Comprobar cuotas y límites

3. **WhatsApp no conecta**
   - Asegurar permisos de navegador
   - Verificar que no haya otras sesiones activas

### Logs del Sistema

```bash
# Logs del backend
pm2 logs crm-backend

# Logs del frontend
pm2 logs crm-frontend

# Logs de PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

---

## 📞 Soporte Técnico

Para obtener ayuda:

1. Revisar la documentación completa en `docs/DEPLOYMENT_GUIDE.md`
2. Verificar logs del sistema para errores específicos
3. Comprobar configuración de variables de entorno
4. Asegurar que todos los servicios estén ejecutándose

---

## 📝 Información de Versión

- **Versión**: 1.0.0
- **Node.js**: 18.x+
- **PostgreSQL**: 14.x+
- **Fecha**: Junio 2025

---

## 🔒 Seguridad

- Usar HTTPS en producción
- Configurar firewall apropiadamente
- Mantener API keys seguras
- Realizar respaldos regulares
- Actualizar dependencias periódicamente

---

Este sistema está listo para su uso en producción y ha sido probado con múltiples cuentas de WhatsApp y proveedores de IA.