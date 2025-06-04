# WhatsApp AI CRM - Deployment Guide

## Production Deployment Instructions

### Prerequisites
- Replit account with deployment capability
- PostgreSQL database access
- OpenAI API key
- WhatsApp Business account

### Deployment Steps

1. **Upload Package**
   - Upload entire deployment-package folder to Replit
   - Ensure all files maintain directory structure

2. **Environment Configuration**
   ```bash
   DATABASE_URL=postgresql://your-connection-string
   OPENAI_API_KEY=sk-your-openai-key
   PGDATABASE=your-db-name
   PGHOST=your-db-host
   PGPASSWORD=your-db-password
   PGPORT=5432
   PGUSER=your-db-user
   ```

3. **Deploy Application**
   - Click Deploy button in Replit
   - System will auto-start autonomous services
   - No manual activation required

4. **Connect WhatsApp**
   - Navigate to: `https://your-deployment.replit.app/whatsapp-management`
   - Scan QR code with WhatsApp Business
   - System begins autonomous operation

### Verification

Check these endpoints post-deployment:
- `/api/auto-response/status` - System status
- `/api/dashboard-stats` - Metrics
- `/health` - Health check

### System Features

**Autonomous Operation**
- Operates without frontend dependency
- 24/7 AI response system
- Automatic lead generation
- Multi-account WhatsApp support

**API Functions**
- 81+ endpoint functions
- Real-time WebSocket communication
- External agent integration
- Calendar synchronization
- Multimedia processing

### Monitoring

The system logs show operational status:
- "📊 Verificando estado estable" - System checking
- "✅ Cuenta X - Respuestas automáticas ACTIVAS" - Active responses
- "💚 Heartbeat recibido" - System health

### Support

For deployment issues:
1. Check environment variables
2. Verify database connectivity
3. Confirm OpenAI API key validity
4. Review system logs for errors

The system is designed for autonomous operation requiring minimal intervention.