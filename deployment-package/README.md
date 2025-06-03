# Sistema CRM WhatsApp AI - Versión Actualizada

## Nuevas Características Implementadas

### Sistema de Seguimiento Completo de Actividades de Agentes

Este deployment incluye las últimas actualizaciones del sistema de monitoreo intensivo de actividades de agentes con las siguientes características:

#### ✅ Seguimiento Completo de Sesión
- **Inicio/Cierre de sesión**: Registra cuando los agentes inician y terminan sus sesiones
- **Navegación entre páginas**: Captura todos los movimientos entre secciones de la aplicación
- **Tiempo de inactividad**: Detecta períodos de inactividad de 5+ minutos
- **Foco de ventana**: Registra cuando los agentes pierden/recuperan el foco de la aplicación
- **Duración en páginas**: Mide cuánto tiempo pasan en cada sección

#### ✅ Interacciones Detalladas
- **Clics en botones**: Captura todos los botones presionados con contexto
- **Clics en enlaces**: Registra navegación mediante enlaces
- **Formularios**: Seguimiento de envíos y cambios en campos
- **Scroll**: Detecta cuánto scroll hacen en las páginas
- **Teclas especiales**: Registra uso de teclas como Enter, Escape, F1-F5

#### ✅ Sistema de Traducción Inteligente
- **Descripciones legibles**: Convierte códigos técnicos en descripciones claras en español
- **Categorización**: Organiza actividades por tipo (Seguridad, Navegación, Interacción, etc.)
- **Iconos contextuales**: Asigna emojis apropiados para cada tipo de actividad
- **Prioridades**: Clasifica actividades por importancia (alta, media, baja)

#### ✅ Interfaz de Usuario Mejorada
- **Vista detallada**: Panel completo con todas las actividades del agente
- **Preview rápido**: Vista previa con actividades recientes y estadísticas
- **Información de página**: Muestra en qué página se realizó cada actividad
- **Filtros y búsqueda**: Capacidad de filtrar actividades por tipo y fecha

## Archivos Principales Actualizados

### Frontend
- `client/src/hooks/useIntensiveActivityTracker.tsx` - Hook principal de seguimiento
- `client/src/pages/UserManagement.tsx` - Interfaz de gestión de usuarios actualizada

### Backend
- `server/utils/activityTranslator.ts` - Sistema de traducción de actividades
- `server/db.ts` - Configuración de base de datos
- `server/storage.ts` - Capa de persistencia actualizada
- `shared/schema.ts` - Esquemas de base de datos actualizados

## Instalación y Configuración

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar base de datos**:
   - Asegurar que DATABASE_URL esté configurada
   - Ejecutar migraciones: `npm run db:push`

3. **Variables de entorno requeridas**:
   ```
   DATABASE_URL=postgresql://...
   OPENAI_API_KEY=sk-...
   ```

4. **Iniciar aplicación**:
   ```bash
   npm run dev
   ```

## Características de Monitoreo

### Eventos Capturados Automáticamente
- Inicio/fin de sesión de agentes
- Navegación entre páginas con duración
- Interacciones con botones y formularios
- Períodos de inactividad
- Cambios de foco de ventana
- Scroll y tiempo en página

### Panel de Actividades
Acceder desde **Gestión de Usuarios** > **Ver Todas las Actividades** para cada agente:

- Vista cronológica de todas las actividades
- Descripciones en español claro
- Información de página donde ocurrió cada actividad
- Estadísticas de uso y comportamiento
- Filtros por categoría y fecha

### Seguridad y Privacidad
- Solo se registran interacciones, no contenido sensible
- Almacenamiento seguro en PostgreSQL
- Acceso restringido por roles de usuario
- No se capturan contraseñas ni datos personales

## Uso del Sistema

Los administradores pueden:
1. Ver actividad en tiempo real de todos los agentes
2. Revisar historial completo de sesiones
3. Identificar patrones de uso y comportamiento
4. Detectar períodos de inactividad
5. Analizar eficiencia en navegación

El sistema registra automáticamente toda la actividad sin requerir configuración adicional por parte de los agentes.

## Soporte Técnico

Para consultas técnicas o problemas de implementación:
- Revisar logs del servidor para errores de conexión
- Verificar configuración de base de datos
- Confirmar variables de entorno
- Validar permisos de usuario

---

**Versión**: Actualizada con sistema de seguimiento completo de actividades
**Fecha**: Junio 2025
**Compatibilidad**: PostgreSQL, Node.js 18+, React 18+