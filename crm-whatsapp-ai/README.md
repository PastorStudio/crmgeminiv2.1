# CRM con WhatsApp e IA integrada

Este es un sistema CRM completo con integración de WhatsApp y motores de IA dual (Google Gemini y OpenAI) para la gestión inteligente de clientes y automatización de respuestas.

## Características principales

- Conexión directa a WhatsApp sin APIs de terceros mediante escaneo de código QR
- Respuestas automáticas gestionadas por IA (Gemini o OpenAI) configurables
- Base de datos PostgreSQL para almacenamiento persistente
- Interfaz de usuario moderna y responsiva
- Gestión completa de leads y pipeline de ventas
- Análisis de datos y estadísticas
- Integración con Telegram (opcional)
- Funcionamiento en servidores propios sin dependencia de servicios externos

## Requisitos del sistema

- Node.js v18 o superior
- PostgreSQL 13 o superior
- 2GB RAM mínimo (recomendado 4GB)
- Claves API para Gemini y/o OpenAI

## Instalación rápida

1. Clona este repositorio
```bash
git clone https://github.com/tu-usuario/crm-whatsapp-ai.git
cd crm-whatsapp-ai
```

2. Ejecuta el script de instalación
```bash
chmod +x install.sh
./install.sh
```

3. Configura tus variables de entorno en el archivo `.env`

4. Inicia el servidor
```bash
npm start
```

## Instalación en servidor VPS

Consulta la [guía detallada de instalación](INSTALL.md) para configurar el sistema en un servidor VPS con dominio personalizado.

## Documentación

- [Manual de usuario](docs/MANUAL.md)
- [API Reference](docs/API.md)
- [Configuración de IA](docs/AI_CONFIG.md)
- [Solución de problemas](docs/TROUBLESHOOTING.md)

## Licencia

Este proyecto está licenciado bajo los términos de la licencia MIT.