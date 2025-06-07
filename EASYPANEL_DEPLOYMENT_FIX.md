# EasyPanel Deployment Fix Guide

## Error Diagnosis
The deployment failed because EasyPanel was trying to use an incorrect Dockerfile path from a GitHub URL instead of the local Dockerfile.

## Fixed Configuration

### Correct GitHub Repository Information:
```
Repository URL: https://github.com/PastorStudio/geminiaicrm
Branch: main
Build Context: / (root directory)
Dockerfile: Dockerfile (in root)
```

### Required Secrets in EasyPanel:
```
POSTGRES_PASSWORD=your_secure_password_here
OPENAI_API_KEY=sk-your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
JWT_SECRET=your_jwt_secret_32_chars_minimum
SESSION_SECRET=your_session_secret_32_chars_minimum
```

## EasyPanel Configuration Steps:

### 1. Create New Project
- Project Name: `crm-whatsapp-ai`
- Description: `AI-powered WhatsApp CRM system`

### 2. Add PostgreSQL Service
- Service Type: `PostgreSQL`
- Version: `15`
- Database Name: `crm_whatsapp_ai`
- Username: `postgres`
- Password: Use secret `POSTGRES_PASSWORD`

### 3. Add Main Application Service
- Service Type: `App`
- Source: `GitHub`
- Repository: `https://github.com/PastorStudio/geminiaicrm`
- Branch: `main`
- Build Type: `Dockerfile`
- Dockerfile Path: `Dockerfile`
- Port: `3000`

### 4. Environment Variables for App Service:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=${{ services.postgres.DATABASE_URL }}
OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }}
GEMINI_API_KEY=${{ secrets.GEMINI_API_KEY }}
JWT_SECRET=${{ secrets.JWT_SECRET }}
SESSION_SECRET=${{ secrets.SESSION_SECRET }}
POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
FRONTEND_URL=https://${{ domains.app.host }}
API_BASE_URL=https://${{ domains.app.host }}
```

### 5. Volume Mounts:
```
/app/whatsapp-sessions -> whatsapp-sessions-volume
/app/uploads -> uploads-volume
/app/logs -> logs-volume
```

### 6. Resource Allocation:
```
Memory: 1024MB - 2048MB
CPU: 0.5 - 1.0 cores
Storage: 20GB minimum
```

## Alternative: Use easypanel-fixed.yml

Import the provided `easypanel-fixed.yml` configuration file directly into EasyPanel for automated setup.

## Deployment Verification:

After deployment, verify these endpoints:
1. `https://your-app.easypanel.host/api/health` - Health check
2. `https://your-app.easypanel.host/` - Main application
3. `https://your-app.easypanel.host/api/whatsapp-accounts` - API functionality

## Common Issues and Solutions:

### Build Fails:
- Ensure Node.js 18+ is available
- Check that all dependencies are in package.json
- Verify Dockerfile is in repository root

### Database Connection Issues:
- Confirm PostgreSQL service is running
- Check DATABASE_URL environment variable
- Verify init.sql is being executed

### Application Startup Issues:
- Check all required secrets are configured
- Verify port 3000 is exposed
- Monitor application logs for specific errors

### WhatsApp Connection Problems:
- Ensure whatsapp-sessions volume is mounted
- Check that puppeteer dependencies are installed
- Verify QR code generation endpoints are accessible

## Manual Dockerfile Build Test:
```bash
# Test locally before deploying
docker build -t crm-whatsapp-ai .
docker run -p 3000:3000 --env-file .env crm-whatsapp-ai
```

This configuration should resolve the deployment issues and provide a working CRM WhatsApp AI system on EasyPanel.