# Sistema Multi-Tenant - Aislamiento de Datos por Usuario

## Descripción General

El sistema CRM WhatsApp AI ahora implementa un sistema multi-tenant completo donde cada usuario solo puede acceder a los datos que le han sido específicamente asignados. Esto garantiza la seguridad y privacidad de la información entre diferentes usuarios y organizaciones.

## Características Principales

### 1. Aislamiento de Datos por Usuario
- **Filtrado automático**: Cada usuario ve únicamente las cuentas WhatsApp, leads, conversaciones y datos a los que tiene acceso
- **Asignaciones granulares**: Los administradores pueden asignar cuentas específicas a usuarios individuales
- **Roles y permisos**: Sistema de roles jerárquicos con permisos específicos por funcionalidad

### 2. Estructura Organizacional
- **Organizaciones**: Agrupación de usuarios bajo una entidad organizacional
- **Jerarquía de usuarios**: Supervisores y subordinados para estructura empresarial
- **Departamentos**: Organización por áreas de trabajo (Ventas, Atención al Cliente, etc.)

### 3. Roles del Sistema

#### Super Admin
- Acceso completo a todas las funciones y datos
- Gestión de organizaciones y usuarios
- Configuración global del sistema

#### Admin
- Gestión completa dentro de su organización
- Asignación de cuentas WhatsApp a usuarios
- Administración de usuarios y roles
- Acceso a reportes avanzados

#### Manager
- Supervisión de agentes asignados
- Gestión de leads y conversaciones
- Reportes de su área
- Exportación de datos limitada

#### Agent
- Acceso solo a cuentas asignadas
- Gestión de leads asignados
- Envío de mensajes
- Vista limitada de reportes

#### Readonly
- Solo lectura de datos asignados
- Sin capacidad de modificación
- Acceso a reportes básicos

## Implementación Técnica

### Base de Datos

#### Nuevas Tablas

**organizations**
```sql
- id: Identificador único
- name: Nombre de la organización
- description: Descripción opcional
- status: Estado (active/inactive)
- createdAt, updatedAt: Timestamps
```

**user_account_assignments**
```sql
- id: Identificador único
- userId: Referencia al usuario
- whatsappAccountId: Referencia a la cuenta WhatsApp
- role: Rol específico en esa cuenta
- permissions: Permisos específicos
- assignedBy: Usuario que realizó la asignación
- assignedAt: Fecha de asignación
- isActive: Estado de la asignación
```

#### Campos Agregados

**users**
- `organizationId`: Referencia a la organización
- `supervisorId`: Referencia al supervisor
- `role`: Rol del usuario en el sistema
- `department`: Departamento al que pertenece
- `permissions`: Array de permisos
- `assignedAccounts`: Array de IDs de cuentas asignadas

**whatsapp_accounts**
- `organizationId`: Referencia a la organización propietaria

### Middleware de Autenticación

El middleware `multiTenantAuth` se ejecuta en todas las rutas protegidas y:

1. **Valida la sesión** del usuario
2. **Obtiene permisos** y asignaciones desde la base de datos
3. **Calcula accesos** disponibles según el rol
4. **Inyecta información** del usuario autenticado en la request

### API Endpoints Multi-Tenant

#### `/api/tenant/accounts`
- Lista cuentas WhatsApp accesibles para el usuario
- Filtrado automático según asignaciones
- Información de permisos incluida

#### `/api/tenant/leads`
- Leads filtrados por cuentas accesibles
- Parámetros de búsqueda respetan restricciones
- Información de permisos de gestión

#### `/api/tenant/conversations`
- Conversaciones de cuentas asignadas únicamente
- Filtrado por permisos de visualización
- Capacidades de envío según rol

#### `/api/tenant/dashboard/stats`
- Estadísticas calculadas solo con datos accesibles
- Métricas ajustadas al nivel de acceso
- Información contextual del usuario

#### `/api/tenant/users/assignments` (Solo Admins)
- Gestión de usuarios y sus asignaciones
- Vista completa de la estructura organizacional
- Herramientas de asignación de cuentas

#### `/api/tenant/profile`
- Información del perfil del usuario actual
- Permisos y asignaciones detalladas
- Estadísticas personales

### Funciones de Filtrado

#### `getAccessibleAccountIds(user, requestedIds?)`
Retorna las cuentas WhatsApp a las que el usuario puede acceder:
- Admins: Todas las cuentas solicitadas
- Otros roles: Solo cuentas asignadas

#### `canAccessAccount(user, accountId)`
Verifica si un usuario puede acceder a una cuenta específica

#### `hasPermission(user, permission)`
Valida si el usuario tiene un permiso específico

#### `getUserDataFilters(user)`
Genera filtros de base de datos para consultas automáticas

## Seguridad

### Principios de Seguridad
1. **Deny by Default**: Sin asignación explícita, no hay acceso
2. **Least Privilege**: Solo los permisos mínimos necesarios
3. **Separation of Duties**: Roles claramente definidos
4. **Audit Trail**: Registro de asignaciones y cambios

### Validaciones
- Verificación de permisos en cada endpoint
- Filtrado automático en consultas de base de datos
- Validación de parámetros según acceso del usuario
- Prevención de escalada de privilegios

## Uso Práctico

### Configuración Inicial

1. **Crear Organización**
```sql
INSERT INTO organizations (name, description) 
VALUES ('Mi Empresa', 'Organización principal');
```

2. **Asignar Usuario Admin**
```sql
UPDATE users SET 
  organizationId = 1, 
  role = 'admin',
  permissions = ARRAY['manage_users', 'manage_accounts', 'view_reports']
WHERE id = 1;
```

3. **Crear Asignación de Cuenta**
```sql
INSERT INTO user_account_assignments 
(userId, whatsappAccountId, role, assignedBy) 
VALUES (2, 1, 'operator', 1);
```

### Flujo de Trabajo Típico

1. **Admin** crea usuarios y asigna roles
2. **Admin** asigna cuentas WhatsApp específicas a cada usuario
3. **Usuarios** acceden solo a sus datos asignados
4. **Manager** supervisa agentes bajo su cargo
5. **Reportes** reflejan solo datos accesibles para cada usuario

## Beneficios

### Para la Empresa
- **Seguridad de datos**: Información protegida entre departamentos
- **Cumplimiento**: Facilita auditorías y regulaciones
- **Escalabilidad**: Fácil agregar nuevos usuarios y organizaciones
- **Control granular**: Permisos específicos por funcionalidad

### Para los Usuarios
- **Interfaz limpia**: Solo ven información relevante
- **Mejor rendimiento**: Consultas optimizadas y focalizadas
- **Responsabilidad clara**: Acceso definido a recursos específicos
- **Experiencia personalizada**: Dashboard adaptado al rol

## Monitoreo y Auditoría

### Métricas Disponibles
- Usuarios activos por organización
- Asignaciones de cuentas por usuario
- Actividad por rol y departamento
- Intentos de acceso no autorizado

### Logs de Auditoría
- Creación y modificación de asignaciones
- Cambios de permisos y roles
- Accesos a datos sensibles
- Actividad de administradores

## Próximas Mejoras

1. **Interface de Administración**: Panel visual para gestión de usuarios
2. **Permisos Temporales**: Asignaciones con fecha de expiración
3. **Delegación de Permisos**: Permitir que managers asignen accesos
4. **Integración SSO**: Autenticación con sistemas externos
5. **API de Auditoría**: Endpoints dedicados para logs y métricas

## Soporte Técnico

Para consultas sobre la implementación del sistema multi-tenant, referirse a:
- `server/middleware/multiTenantAuth.ts`: Lógica de autenticación
- `server/routes/multiTenantRoutes.ts`: Endpoints específicos
- `shared/schema.ts`: Estructura de base de datos
- Archivos de migración en `sql/migrations/`