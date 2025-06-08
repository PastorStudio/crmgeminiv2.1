# Guía de Instalación APK - WhatsApp CRM Mobile

Esta guía te ayudará a generar e instalar el archivo APK de la aplicación móvil WhatsApp CRM en dispositivos Android.

## Requisitos Previos

### 1. Instalar Node.js y npm
- Descargar desde: https://nodejs.org/
- Versión recomendada: 18 o superior

### 2. Instalar Expo CLI y EAS CLI
```bash
npm install -g @expo/cli eas-cli
```

### 3. Crear cuenta en Expo (gratuito)
- Ir a: https://expo.dev
- Crear cuenta gratuita
- Confirmar email

## Configuración Inicial

### Paso 1: Configurar IP del Servidor
Antes de generar el APK, configurar la IP de tu servidor CRM:

1. **Encontrar la IP del servidor**:
   ```bash
   # En Windows
   ipconfig
   
   # En Linux/Mac
   ifconfig
   ```

2. **Editar archivo de configuración**:
   - Abrir: `mobile-app/src/services/ApiService.js`
   - Cambiar línea 6:
   ```javascript
   const BASE_URL = 'http://TU_IP_AQUI:5000';
   // Ejemplo: const BASE_URL = 'http://192.168.1.100:5000';
   ```

### Paso 2: Preparar Assets (Opcional)
```bash
cd mobile-app
npm run prepare-assets
```

## Métodos de Generación APK

### Método 1: APK de Desarrollo (Recomendado)

Este método genera un APK rápidamente para pruebas:

```bash
# Navegar a la carpeta mobile-app
cd mobile-app

# Instalar dependencias
npm install

# Iniciar sesión en Expo
eas login

# Configurar proyecto (solo primera vez)
eas build:configure

# Generar APK de desarrollo
npm run build:android-apk
```

**Tiempo estimado**: 10-15 minutos

### Método 2: APK de Producción

Para distribución final optimizada:

```bash
# Generar APK de producción
npm run build:android-production-apk
```

**Tiempo estimado**: 15-20 minutos

## Proceso de Construcción

### 1. Subida del Código
EAS subirá tu código a sus servidores de construcción.

### 2. Construcción en la Nube
- Se instalan las dependencias
- Se compila la aplicación React Native
- Se genera el archivo APK

### 3. Descarga
Al finalizar, recibirás:
- Email con enlace de descarga
- URL directa en la terminal
- Enlace en el dashboard de Expo

## Instalación en Android

### Opción A: Descarga Directa
1. **Desde el dispositivo Android**:
   - Abrir el enlace de descarga en el navegador
   - Descargar el archivo APK
   - Cuando pregunte sobre "Fuentes desconocidas", permitir instalación
   - Seguir las instrucciones de instalación

### Opción B: Transferencia Manual
1. **Descargar APK en computadora**
2. **Transferir al dispositivo**:
   - USB/Cable
   - Bluetooth
   - Google Drive/Dropbox
3. **Instalar desde archivos**:
   - Abrir administrador de archivos
   - Localizar archivo APK
   - Tocar para instalar

## Configuración de Seguridad Android

### Permitir Instalación desde Fuentes Desconocidas

**Android 8.0+**:
1. Configuración → Aplicaciones
2. Menú → Acceso especial → Instalar aplicaciones desconocidas
3. Seleccionar navegador/administrador de archivos
4. Activar "Permitir desde esta fuente"

**Android 7.0 y anteriores**:
1. Configuración → Seguridad
2. Activar "Fuentes desconocidas"

## Verificación de Instalación

### 1. Conexión al Servidor
Al abrir la app por primera vez:
- Verificar que aparezcan datos del dashboard
- Comprobar estado de conexión WhatsApp
- Probar navegación entre pestañas

### 2. Funcionalidades Principales
- **Dashboard**: Estadísticas en tiempo real
- **Leads**: Lista de leads y filtros
- **Mensajes**: Estado de WhatsApp
- **Plantillas**: Gestión de mensajes

## Solución de Problemas

### Error: "No se puede conectar al servidor"
1. **Verificar IP del servidor** en ApiService.js
2. **Confirmar que el servidor esté ejecutándose**
3. **Asegurar que ambos dispositivos estén en la misma red**
4. **Verificar firewall/puerto 5000**

### Error: "App no se instala"
1. **Liberar espacio** en el dispositivo (mín. 100MB)
2. **Activar fuentes desconocidas**
3. **Reiniciar dispositivo** y intentar de nuevo

### Error durante la construcción
1. **Verificar conexión a internet**
2. **Confirmar que el proyecto no tenga errores**:
   ```bash
   npm run start
   ```
3. **Revisar logs de EAS Build**

## Distribución Interna

### Compartir APK con el Equipo
1. **Subir APK a Google Drive/Dropbox**
2. **Enviar enlace de descarga**
3. **Incluir estas instrucciones de instalación**

### Control de Versiones
Para nuevas versiones:
1. **Actualizar version en app.json**:
   ```json
   "version": "1.1.0",
   "android": {
     "versionCode": 2
   }
   ```
2. **Repetir proceso de construcción**

## Scripts Disponibles

```bash
# Desarrollo local
npm start                    # Iniciar con Expo Go
npm run android             # Ejecutar en emulador Android

# Construcción APK
npm run build:android-apk   # APK de desarrollo
npm run build:android-production-apk  # APK de producción

# Utilidades
npm run prepare-assets      # Preparar íconos placeholder
```

## Costos

- **Expo/EAS**: Gratuito (hasta 30 construcciones/mes)
- **Google Play Store** (opcional): $25 USD (una vez)

## Notas Importantes

1. **Primera construcción** puede tomar más tiempo
2. **Mantener actualizada** la IP del servidor en ApiService.js
3. **Generar nueva versión** después de cada cambio importante
4. **Probar en diferentes dispositivos** Android antes de distribución final

## Soporte

Para problemas específicos:
1. **Revisar logs** de EAS Build
2. **Verificar configuración** de red y firewall
3. **Comprobar compatibilidad** del dispositivo Android (mín. API 21/Android 5.0)

La aplicación está ahora lista para distribución interna y uso en dispositivos Android.