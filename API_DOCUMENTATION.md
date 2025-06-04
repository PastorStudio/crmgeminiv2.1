# WhatsApp AI CRM System - Complete API Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Autonomous Response System](#autonomous-response-system)
3. [WhatsApp Management](#whatsapp-management)
4. [AI & Intelligence](#ai--intelligence)
5. [Lead Management](#lead-management)
6. [External Agents](#external-agents)
7. [Calendar Integration](#calendar-integration)
8. [Analytics & Dashboard](#analytics--dashboard)
9. [Authentication & Security](#authentication--security)
10. [WebSocket Events](#websocket-events)

## System Overview

### Base URL
```
Production: https://your-deployment.replit.app
Development: http://localhost:5000
```

### Key Features
- **Autonomous WhatsApp AI Response System**: Operates independently without frontend
- **Multi-Account WhatsApp Management**: Handle multiple business accounts
- **Intelligent Lead Generation**: Auto-convert conversations to leads
- **External Agent Integration**: Connect with third-party AI agents
- **Local Calendar Sync**: Automatic appointment scheduling
- **Real-time Analytics**: Live dashboard with WebSocket updates

## Autonomous Response System

### Core Autonomous Endpoints

#### Force Autonomous Activation
```http
POST /api/force-autonomous-activation
```
**Description**: Manually trigger complete autonomous system activation
**Response**: 
```json
{
  "success": true,
  "message": "Autonomous systems activated",
  "activeAccounts": 1,
  "systemsInitialized": [
    "StableAutoResponseManager",
    "TrulyIndependentAutoResponseSystem"
  ]
}
```

#### Auto Response Status
```http
GET /api/auto-response/status
```
**Response**:
```json
{
  "autonomousSystemActive": true,
  "accounts": [
    {
      "accountId": 1,
      "autoResponseEnabled": true,
      "lastActivity": "2025-06-03T10:21:36Z",
      "agentAssigned": "Smart Assistant"
    }
  ]
}
```

#### Activate Auto Response
```http
POST /api/auto-response/activate/:accountId
```
**Parameters**:
- `accountId` (path): WhatsApp account ID

#### Deactivate Auto Response
```http
POST /api/auto-response/deactivate/:accountId
```

### Enhanced Auto Response
```http
POST /api/enhanced-auto-response/activate/:accountId
POST /api/enhanced-auto-response/deactivate/:accountId
GET /api/enhanced-auto-response/status
```

## WhatsApp Management

### Account Management

#### Get WhatsApp Account
```http
GET /api/whatsapp-accounts/:accountId
```
**Response**:
```json
{
  "id": 1,
  "name": "Sales Account",
  "status": "connected",
  "phoneNumber": "+1234567890",
  "qrCode": "data:image/png;base64,...",
  "lastActivity": "2025-06-03T10:21:36Z"
}
```

#### Get All Chats
```http
GET /api/direct/whatsapp/chats
```
**Response**:
```json
{
  "success": true,
  "chats": [
    {
      "id": "1234567890@c.us",
      "name": "John Doe",
      "lastMessage": "Hello, I need help",
      "timestamp": "2025-06-03T10:20:00Z",
      "unreadCount": 1
    }
  ]
}
```

#### Send Message
```http
POST /api/whatsapp/:accountId/send-message
```
**Body**:
```json
{
  "chatId": "1234567890@c.us",
  "message": "Hello! How can I help you today?"
}
```

### Connection Management

#### Force Ready State
```http
POST /api/whatsapp/:accountId/force-ready
```

#### Start Keepalive
```http
POST /api/whatsapp/:accountId/start-keepalive
```

#### Stop Keepalive
```http
POST /api/whatsapp/:accountId/stop-keepalive
```

#### Ping Status All
```http
GET /api/whatsapp/ping-status/all
```

## AI & Intelligence

### AI Prompts Management

#### Get AI Prompts
```http
GET /api/ai-prompts
```
**Response**:
```json
{
  "prompts": [
    {
      "id": 1,
      "name": "Sales Assistant",
      "content": "You are a helpful sales assistant...",
      "createdAt": "2025-06-03T10:00:00Z"
    }
  ]
}
```

#### Create AI Prompt
```http
POST /api/ai-prompts
```
**Body**:
```json
{
  "name": "Customer Support",
  "content": "You are a customer support agent..."
}
```

#### Update AI Prompt
```http
PUT /api/ai-prompts/:id
```

#### Delete AI Prompt
```http
DELETE /api/ai-prompts/:id
```

### AI Settings

#### Get AI Settings
```http
GET /api/ai-settings
```

#### Update AI Settings
```http
POST /api/ai-settings
```
**Body**:
```json
{
  "provider": "openai",
  "model": "gpt-4o",
  "temperature": 0.7,
  "maxTokens": 150
}
```

### Intelligent Response Processing

#### Process Message with AI
```http
POST /api/ai/process-message
```
**Body**:
```json
{
  "accountId": 1,
  "chatId": "1234567890@c.us",
  "message": "I want to buy your product",
  "context": "previous conversation history"
}
```

#### Analyze Conversation
```http
POST /api/ai/analyze-conversation
```
**Body**:
```json
{
  "accountId": 1,
  "chatId": "1234567890@c.us",
  "messages": ["array", "of", "messages"]
}
```

#### Generate Lead from Conversation
```http
POST /api/ai/generate-lead
```

## Lead Management

### Lead Operations

#### Get Leads
```http
GET /api/leads-cards
```
**Response**:
```json
{
  "leads": [
    {
      "id": 1,
      "name": "John Doe",
      "phone": "+1234567890",
      "email": "john@example.com",
      "status": "new",
      "source": "whatsapp",
      "value": "$1000",
      "createdAt": "2025-06-03T10:00:00Z"
    }
  ]
}
```

#### Update Lead Stage
```http
PUT /api/leads/:leadId/stage
```
**Body**:
```json
{
  "stage": "qualified",
  "notes": "Customer interested in premium package"
}
```

#### Convert Chats to Leads
```http
POST /api/whatsapp/:accountId/convert-chats-to-leads
```

### Automatic Lead Generation

#### Generate Automatic Leads
```http
POST /api/automatic-leads/generate/:accountId
```

#### Analyze Chat for Lead Potential
```http
POST /api/automatic-leads/analyze/:accountId/:chatId
```

## External Agents

### Agent Management

#### Get External Agents
```http
GET /api/external-agents
```
**Response**:
```json
{
  "success": true,
  "agents": [
    {
      "id": "1",
      "agentName": "Sales Assistant",
      "agentUrl": "https://api.example.com/agent",
      "provider": "custom",
      "status": "active",
      "responseCount": 150,
      "averageResponseTime": 2.5
    }
  ]
}
```

#### Create External Agent
```http
POST /api/create-external-agent
```
**Body**:
```json
{
  "agentName": "Customer Support Bot",
  "agentUrl": "https://api.example.com/support",
  "provider": "custom",
  "apiKey": "optional-api-key"
}
```

#### Assign External Agent
```http
POST /api/whatsapp-accounts/:accountId/assign-external-agent
```
**Body**:
```json
{
  "agentId": "1"
}
```

### Agent Communication

#### Chat with External Agent
```http
POST /api/ai/chat-with-external-agent
```
**Body**:
```json
{
  "agentId": "1",
  "message": "Customer wants product information",
  "context": "Previous conversation context"
}
```

#### Agent Heartbeat
```http
POST /api/agents/:agentId/heartbeat
```

#### Get Live Agent Status
```http
GET /api/agents/live-status
```

#### Check Agent Activity
```http
GET /api/agents/:agentId/is-active
```

## Calendar Integration

### Event Management

#### Create Calendar Event
```http
POST /api/calendar/create-event
```
**Body**:
```json
{
  "title": "Sales Meeting",
  "description": "Follow up with lead",
  "startTime": "2025-06-04T14:00:00Z",
  "endTime": "2025-06-04T15:00:00Z",
  "attendees": ["client@example.com"],
  "leadId": 1
}
```

#### Get Calendar Events
```http
GET /api/calendar/events?start=2025-06-01&end=2025-06-30
```

## Analytics & Dashboard

### Dashboard Metrics

#### Get Dashboard Stats
```http
GET /api/dashboard-stats
```
**Response**:
```json
{
  "id": 1,
  "totalLeads": 45,
  "newLeadsThisMonth": 12,
  "conversionRate": 25.5,
  "activeChats": 8,
  "responseTime": "2.3 minutes",
  "agentsOnline": 3
}
```

#### Get Dashboard Metrics
```http
GET /api/dashboard-metrics
```
**Response**:
```json
{
  "leadsToday": 5,
  "messagesProcessed": 150,
  "responseRate": 98.5,
  "avgResponseTime": 1.8
}
```

### Activity Tracking

#### Get Activities
```http
GET /api/activities
```

#### Get Agent Activities
```http
GET /api/agent-activities
```

#### Record Agent Activity
```http
POST /api/agent-activity
```
**Body**:
```json
{
  "agentId": 3,
  "activityType": "message_sent",
  "details": "Responded to customer inquiry",
  "category": "communication"
}
```

## Authentication & Security

### Session Management

#### Get Current Session
```http
GET /api/auth/session
```

#### Login
```http
POST /api/auth/login
```
**Body**:
```json
{
  "username": "admin",
  "password": "secure_password"
}
```

#### Logout
```http
POST /api/auth/logout
```

## Advanced Features

### Multimedia Processing

#### Process Multimedia Message
```http
POST /api/multimedia/process/:accountId/:chatId/:messageId
```

#### Transcribe Audio Message
```http
POST /api/multimedia/transcribe/:accountId/:chatId/:messageId
```

### Web Scraping

#### Activate Web Scraping
```http
POST /api/web-scraping/activate/:accountId
```

#### Deactivate Web Scraping
```http
POST /api/web-scraping/deactivate/:accountId
```

#### Get Web Scraping Status
```http
GET /api/web-scraping/status/:accountId
```

### System Management

#### Reset All Data
```http
POST /api/system/reset-all
```
**Warning**: This endpoint clears all system data

#### Populate Demo Data
```http
POST /api/system/populate-demo-data
```

#### Refresh WhatsApp Data
```http
POST /api/whatsapp/refresh-data
```

## WebSocket Events

### Connection
```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const wsUrl = `${protocol}//${window.location.host}/ws`;
const socket = new WebSocket(wsUrl);
```

### Event Types

#### New Message
```json
{
  "type": "new_message",
  "data": {
    "accountId": 1,
    "chatId": "1234567890@c.us",
    "message": "Hello!",
    "timestamp": "2025-06-03T10:21:36Z"
  }
}
```

#### Lead Created
```json
{
  "type": "lead_created",
  "data": {
    "leadId": 123,
    "name": "John Doe",
    "source": "whatsapp"
  }
}
```

#### Agent Status Change
```json
{
  "type": "agent_status",
  "data": {
    "agentId": "1",
    "status": "online",
    "lastActivity": "2025-06-03T10:21:36Z"
  }
}
```

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details",
  "timestamp": "2025-06-03T10:21:36Z"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

### Limits
- API calls: 1000 requests per hour per IP
- WebSocket connections: 10 concurrent connections per IP
- File uploads: 50MB maximum file size

## Authentication

### API Keys
Some endpoints require API key authentication:
```http
Authorization: Bearer your-api-key-here
```

### Session Cookies
Web interface uses session-based authentication with secure cookies.

---

## Quick Start Guide

### 1. Deploy the System
Deploy to Replit and the autonomous system will activate automatically.

### 2. Connect WhatsApp
Navigate to `/whatsapp-management` and scan the QR code with your WhatsApp Business account.

### 3. Configure AI
Set up your AI prompts and external agents through the dashboard.

### 4. Enable Auto Responses
```bash
curl -X POST "https://your-deployment.replit.app/api/auto-response/activate/1"
```

### 5. Monitor Activity
Check `/api/dashboard-stats` for real-time system metrics.

The system will now operate autonomously, responding to WhatsApp messages and generating leads 24/7.