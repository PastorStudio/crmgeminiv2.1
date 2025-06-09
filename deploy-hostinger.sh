#!/bin/bash

# Script de despliegue automático para Hostinger
# WhatsApp CRM System

echo "🚀 Iniciando despliegue en Hostinger..."

# Crear directorio de despliegue
mkdir -p deployment-hostinger
cd deployment-hostinger

# Copiar archivos necesarios para producción
echo "📦 Preparando archivos de producción..."

# Copiar estructura principal
cp -r ../client ./
cp -r ../server ./
cp -r ../shared ./
cp -r ../mobile-app ./

# Copiar archivos de configuración
cp ../package.json ./
cp ../vite.config.ts ./
cp ../tsconfig.json ./
cp ../tailwind.config.ts ./
cp ../postcss.config.js ./
cp ../drizzle.config.ts ./

# Crear .env de producción
cat > .env.production << EOF
# Configuración de producción para Hostinger
NODE_ENV=production
PORT=3000

# Base de datos PostgreSQL (actualizar con credenciales de Hostinger)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
PGHOST=localhost
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=database_name

# APIs opcionales
OPENAI_API_KEY=
GEMINI_API_KEY=
EOF

# Crear package.json optimizado para producción
cat > package.json << EOF
{
  "name": "whatsapp-crm-hostinger",
  "version": "1.0.0",
  "description": "WhatsApp CRM System para Hostinger",
  "main": "server/index.js",
  "scripts": {
    "start": "node server/index.js",
    "build": "vite build",
    "preview": "vite preview",
    "db:push": "drizzle-kit push:pg",
    "db:generate": "drizzle-kit generate:pg",
    "production": "NODE_ENV=production npm start"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "compression": "^1.7.4",
    "helmet": "^7.1.0",
    "@neondatabase/serverless": "^0.9.0",
    "drizzle-orm": "^0.29.0",
    "drizzle-kit": "^0.20.0",
    "ws": "^8.14.2",
    "axios": "^1.6.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Crear servidor optimizado para Hostinger
cat > server/index.js << 'EOF'
const express = require('express');
const path = require('path');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de seguridad y optimización
app.use(helmet({
  contentSecurityPolicy: false, // Permitir recursos inline para React
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos con cache
app.use(express.static(path.join(__dirname, '../dist'), {
  maxAge: '1y',
  etag: false
}));

// Importar rutas API
try {
  const apiRoutes = require('./routes');
  app.use('/api', apiRoutes);
} catch (error) {
  console.log('⚠️ API routes not found, running in static mode');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// Servir aplicación React para todas las rutas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Manejo de errores
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor WhatsApp CRM ejecutándose en puerto ${PORT}`);
  console.log(`📱 Entorno: ${process.env.NODE_ENV}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
});

// Manejo graceful de cierre
process.on('SIGTERM', () => {
  console.log('👋 Cerrando servidor...');
  process.exit(0);
});
EOF

# Crear archivo de configuración para Node.js App en Hostinger
cat > .htaccess << 'EOF'
# Configuración para Hostinger
RewriteEngine On

# Redirigir todo a HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Configuración de cache para archivos estáticos
<FilesMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
    Header append Cache-Control "public, immutable"
</FilesMatch>

# Comprimir archivos
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>
EOF

# Crear script de instalación
cat > install.sh << 'EOF'
#!/bin/bash
echo "📦 Instalando WhatsApp CRM en Hostinger..."

# Instalar dependencias
npm install --production

# Construir aplicación
npm run build

# Configurar base de datos
echo "🗄️ Configurando base de datos..."
npm run db:push

echo "✅ Instalación completada!"
echo "🚀 Para iniciar: npm start"
echo "🌐 Configurar dominio en panel de Hostinger"
EOF

chmod +x install.sh

# Crear archivo de compresión
echo "📦 Creando archivo de despliegue..."
tar -czf ../whatsapp-crm-hostinger.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=dist \
  .

cd ..

echo "✅ Despliegue preparado!"
echo ""
echo "📋 Próximos pasos:"
echo "1. Subir whatsapp-crm-hostinger.tar.gz a tu servidor Hostinger"
echo "2. Extraer: tar -xzf whatsapp-crm-hostinger.tar.gz"
echo "3. Configurar variables en .env.production"
echo "4. Ejecutar: ./install.sh"
echo "5. Configurar Node.js App en panel de Hostinger"
echo ""
echo "📄 Ver guía completa: HOSTINGER_DEPLOYMENT_GUIDE.md"