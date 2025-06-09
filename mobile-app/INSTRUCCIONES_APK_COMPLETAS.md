# Guía Completa: Generar APK de WhatsApp CRM Mobile

## 🎯 Todo está configurado y listo

Su aplicación móvil de WhatsApp CRM está completamente configurada con:
- ✅ Conexión al servidor: http://172.31.128.27:5000
- ✅ Íconos y assets generados
- ✅ Configuración de construcción lista
- ✅ Scripts automatizados

## 📱 Método 1: Usando Expo Go (Recomendado para pruebas)

### Más rápido - Sin necesidad de APK
1. **Descargar Expo Go** desde Google Play Store
2. **Abrir terminal** en la carpeta mobile-app
3. **Ejecutar**: `npm start`
4. **Escanear código QR** con Expo Go
5. **Probar la aplicación** inmediatamente

## 📦 Método 2: Generar APK Instalable

### Opción A: Proceso Automático (Recomendado)
```bash
# Navegar a la carpeta
cd mobile-app

# Ejecutar generador automático
node create-apk-automated.js
```

### Opción B: Proceso Manual (Más control)
```bash
# 1. Crear cuenta gratuita en expo.dev
# 2. Instalar herramientas
npm install -g @expo/cli eas-cli

# 3. Iniciar sesión
npx eas login

# 4. Configurar proyecto
npx eas build:configure

# 5. Generar APK
npx eas build --platform android --profile preview
```

## ⚡ Método 3: APK Local (Sin cuenta Expo)

### Usando React Native CLI
```bash
# Instalar Android Studio y configurar SDK
# Crear APK local
npx react-native run-android --variant=release
```

## 🔧 Configuración del Servidor

### Verificar IP del Servidor
Su app está configurada para conectarse a: **172.31.128.27:5000**

Si necesita cambiar la IP:
1. Editar `src/services/ApiService.js`
2. Cambiar línea 5: `const BASE_URL = 'http://SU_NUEVA_IP:5000';`
3. Regenerar APK

### Verificar Conectividad
```bash
# Probar desde el dispositivo Android
curl http://172.31.128.27:5000/api/whatsapp-accounts

# Debe devolver datos JSON del CRM
```

## 📲 Instalación en Android

### Preparar el Dispositivo
1. **Configuración → Seguridad**
2. **Activar "Fuentes desconocidas"**
3. **Liberar mínimo 100MB de espacio**

### Instalar APK
1. **Transferir APK** al dispositivo (USB/Bluetooth/descarga)
2. **Abrir administrador de archivos**
3. **Tocar el archivo APK**
4. **Permitir instalación** cuando pregunte
5. **Confirmar instalación**

## 🚀 Funcionalidades de la App

### Dashboard
- Estadísticas en tiempo real
- Estado de conexión WhatsApp
- Métricas de leads y mensajes

### Gestión de Leads
- Lista completa de leads
- Filtros por estado
- Detalles de contacto
- Seguimiento de valor

### Monitoreo de Mensajes
- Estado de cuentas WhatsApp
- Cola de mensajes
- Indicadores de conexión

### Plantillas
- Biblioteca de plantillas
- Estadísticas de uso
- Vista previa rápida

## 🔍 Solución de Problemas

### "No se puede conectar al servidor"
- Verificar que el servidor CRM esté funcionando
- Confirmar IP correcta en ApiService.js
- Asegurar que puerto 5000 esté abierto
- Verificar conectividad de red

### "Error al instalar APK"
- Activar "Fuentes desconocidas"
- Liberar más espacio de almacenamiento
- Reiniciar dispositivo
- Intentar instalación desde administrador de archivos

### "La app se cierra al abrir"
- Verificar versión Android (mínimo 5.0)
- Comprobar memoria RAM disponible
- Verificar permisos de aplicación

## 📊 Tiempos Estimados

| Método | Tiempo | Resultado |
|--------|--------|-----------|
| Expo Go | 2-3 minutos | App de prueba |
| APK Automático | 15-20 minutos | APK instalable |
| APK Manual | 10-15 minutos | APK personalizado |

## 📞 Próximos Pasos

1. **Elegir método** de instalación preferido
2. **Seguir pasos** según la opción seleccionada
3. **Probar conectividad** con el servidor CRM
4. **Distribuir APK** al equipo si es necesario

Su aplicación móvil WhatsApp CRM está lista para uso inmediato con todas las funcionalidades del sistema web.