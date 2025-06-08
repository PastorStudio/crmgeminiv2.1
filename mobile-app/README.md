# WhatsApp CRM Mobile App

Una aplicación móvil Android para acceder a tu sistema CRM de WhatsApp desde tu teléfono.

## Características

- **Dashboard en tiempo real**: Estadísticas de leads, ingresos y conversiones
- **Gestión de Leads**: Visualiza, filtra y actualiza leads directamente desde el móvil
- **Mensajes de WhatsApp**: Monitorea conversaciones y estado de cuentas WhatsApp
- **Plantillas de Mensajes**: Crea, edita y gestiona plantillas de mensajes
- **Conversión de Chats**: Convierte conversaciones reales de WhatsApp en leads
- **Sincronización automática**: Datos actualizados en tiempo real con el servidor

## Requisitos

- Android 5.0 (API nivel 21) o superior
- Conexión a internet
- Servidor CRM WhatsApp funcionando en la red

## Instalación

### Opción 1: Desarrollo con Expo (Recomendado)

1. **Instalar Expo CLI globalmente**:
```bash
npm install -g @expo/cli
```

2. **Navegar a la carpeta mobile-app**:
```bash
cd mobile-app
```

3. **Instalar dependencias**:
```bash
npm install
```

4. **Configurar la URL del servidor**:
   - Abrir `src/services/ApiService.js`
   - Cambiar `BASE_URL` por la IP de tu servidor:
   ```javascript
   const BASE_URL = 'http://TU_IP_SERVIDOR:5000';
   // Ejemplo: const BASE_URL = 'http://192.168.1.100:5000';
   ```

5. **Iniciar el desarrollo**:
```bash
npm start
```

6. **Ejecutar en Android**:
   - Instalar Expo Go desde Google Play Store
   - Escanear el código QR desde la terminal
   - O ejecutar: `npm run android` (requiere Android Studio)

### Opción 2: APK para Distribución

1. **Instalar EAS CLI**:
```bash
npm install -g eas-cli
```

2. **Inicializar EAS Build**:
```bash
eas build:configure
```

3. **Generar APK**:
```bash
eas build --platform android --profile preview
```

4. **Descargar e instalar el APK** en dispositivos Android

## Configuración

### Configurar IP del Servidor

Para que la app móvil se conecte a tu servidor CRM, debes configurar la IP correcta:

1. **Encontrar la IP del servidor**:
   ```bash
   # En Windows
   ipconfig
   
   # En Linux/Mac
   ifconfig
   ```

2. **Actualizar ApiService.js**:
   ```javascript
   // En mobile-app/src/services/ApiService.js
   const BASE_URL = 'http://192.168.1.100:5000'; // Reemplaza con tu IP
   ```

3. **Asegurar conectividad**:
   - El teléfono debe estar en la misma red que el servidor
   - El servidor debe estar ejecutándose en el puerto 5000
   - Verificar que no hay firewall bloqueando la conexión

### Configurar CORS en el Servidor

Si tienes problemas de conexión, asegúrate de que el servidor permite conexiones móviles:

1. **Verificar configuración CORS** en `server/index.ts`:
   ```javascript
   app.use(cors({
     origin: '*', // Permite todas las conexiones en desarrollo
     credentials: true
   }));
   ```

## Uso

### Dashboard
- Ve estadísticas en tiempo real
- Monitorea estado de cuentas WhatsApp
- Accede a acciones rápidas

### Leads
- Visualiza todos los leads
- Filtra por estado y busca por nombre/empresa
- Actualiza estado de leads con botones rápidos
- Convierte chats de WhatsApp en nuevos leads

### Mensajes
- Monitorea conversaciones de WhatsApp
- Ve estado de conexión de cuentas
- Busca mensajes específicos

### Plantillas
- Crea nuevas plantillas de mensajes
- Edita plantillas existentes
- Utiliza variables dinámicas con {{variable}}

## Solución de Problemas

### No se conecta al servidor
1. Verificar que el servidor esté ejecutándose
2. Comprobar la IP en ApiService.js
3. Asegurar que ambos dispositivos estén en la misma red
4. Verificar configuración de firewall

### Error de CORS
1. Verificar configuración CORS en el servidor
2. Reiniciar el servidor después de cambios

### App no carga datos
1. Verificar conexión a internet
2. Comprobar logs del servidor
3. Verificar que las APIs estén funcionando

### Problemas de rendimiento
1. Cerrar y reabrir la aplicación
2. Verificar memoria disponible en el dispositivo
3. Limpiar caché de la aplicación

## Estructura del Proyecto

```
mobile-app/
├── App.js                          # Componente principal y navegación
├── src/
│   ├── screens/
│   │   ├── DashboardScreen.js      # Pantalla principal con estadísticas
│   │   ├── LeadsScreen.js          # Gestión de leads
│   │   ├── MessagesScreen.js       # Mensajes de WhatsApp
│   │   └── TemplatesScreen.js      # Plantillas de mensajes
│   └── services/
│       └── ApiService.js           # Comunicación con el servidor
├── package.json                    # Dependencias y scripts
├── app.json                        # Configuración de Expo
└── babel.config.js                 # Configuración de Babel
```

## Características Técnicas

- **Framework**: React Native con Expo
- **UI**: React Native Paper (Material Design)
- **Navegación**: React Navigation
- **Gráficos**: React Native Chart Kit
- **HTTP Client**: Axios
- **Storage**: AsyncStorage para tokens
- **Iconos**: React Native Vector Icons

## Desarrollo

### Agregar nuevas pantallas
1. Crear componente en `src/screens/`
2. Registrar en `App.js` en el Tab Navigator
3. Agregar ícono correspondiente

### Agregar nuevas APIs
1. Crear método en `ApiService.js`
2. Implementar manejo de errores
3. Usar en componentes con try/catch

### Personalizar tema
Modificar colores en `App.js`:
```javascript
const theme = {
  colors: {
    primary: '#10b981',    // Verde principal
    accent: '#3b82f6',     // Azul de acento
    background: '#f8fafc', // Fondo
    surface: '#ffffff',    // Superficie de cards
    text: '#1f2937',       // Texto principal
  },
};
```

## Licencia

Este proyecto es parte del sistema CRM WhatsApp AI y está sujeto a la misma licencia del proyecto principal.

## Soporte

Para problemas técnicos o consultas sobre la app móvil, contacta al equipo de desarrollo.