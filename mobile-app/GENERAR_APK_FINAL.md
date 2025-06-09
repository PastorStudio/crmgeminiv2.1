# APK WhatsApp CRM - Listo para Generar

## ✅ Estado: Completamente Configurado

Su aplicación móvil está lista con:
- Servidor configurado: http://172.31.128.27:5000
- Dependencias instaladas
- Íconos generados
- Scripts automatizados

## 🚀 Opción 1: Prueba Inmediata (Recomendado)

### Usando Expo Go - Sin APK necesario
```bash
cd mobile-app
npm start
```
1. Descargar "Expo Go" desde Play Store
2. Escanear código QR que aparece
3. Probar la aplicación inmediatamente

## 📱 Opción 2: APK Instalable 

### Proceso Simple (5 pasos)
```bash
cd mobile-app

# 1. Crear cuenta gratuita en expo.dev
# 2. Iniciar sesión
npx eas login

# 3. Configurar proyecto
npx eas build:configure

# 4. Generar APK
npx eas build --platform android --profile preview

# 5. Descargar e instalar en Android
```

### Proceso Automatizado
```bash
cd mobile-app
node create-apk-automated.js
```

## ⚡ Opción 3: APK Inmediato

### Si tiene Android Studio instalado
```bash
cd mobile-app
npx expo run:android
```

## 📋 Verificar Funcionamiento

Una vez instalada la app:
1. Abrir "WhatsApp CRM"
2. Verificar dashboard con estadísticas
3. Navegar entre pestañas: Leads, Mensajes, Plantillas
4. Confirmar conexión al servidor CRM

## 🔧 Cambiar IP del Servidor

Si necesita usar diferente IP:
1. Editar: `mobile-app/src/services/ApiService.js`
2. Línea 5: Cambiar `http://172.31.128.27:5000` por su IP
3. Regenerar APK

## 📞 Soporte

Su aplicación móvil incluye:
- Dashboard en tiempo real
- Gestión completa de leads
- Monitoreo de WhatsApp
- Biblioteca de plantillas
- Sincronización automática

Todo está configurado y funcionando correctamente.