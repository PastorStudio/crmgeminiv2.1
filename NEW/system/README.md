# CRM WhatsApp AI - Complete System Components

This directory contains the complete backend and frontend components of the CRM WhatsApp AI system, organized for separate deployment or development.

## 📁 Directory Structure

```
NEW/
├── installer/              # Complete SSH installation system
│   ├── install.sh          # Main installation script
│   └── README.md           # Installation instructions
└── system/                 # Separated system components
    ├── backend/            # Backend API server
    │   ├── package.json    # Backend dependencies
    │   ├── ecosystem.config.js  # PM2 configuration
    │   └── [server files]  # All backend source code
    └── frontend/           # Frontend React application
        ├── package.json    # Frontend dependencies
        ├── vite.config.ts  # Vite configuration
        └── [client files]  # All frontend source code
```

## 🚀 Installation Options

### Option 1: Complete Automated Installation
Use the installer for full system setup with all dependencies:

```bash
# Quick SSH installation
curl -fsSL https://raw.githubusercontent.com/PastorStudio/geminiaicrm/main/NEW/installer/install.sh | sudo bash
```

### Option 2: Separate Component Installation

#### Backend Setup
```bash
cd NEW/system/backend
npm install
npm run build
npm start
```

#### Frontend Setup
```bash
cd NEW/system/frontend
npm install
npm run build
npm run preview
```

## 🔧 Component Details

### Backend Features
- **Express.js API Server** - RESTful API endpoints
- **WhatsApp Integration** - Real-time messaging with whatsapp-web.js
- **Multi-AI Support** - OpenAI, Gemini, Anthropic integration
- **PostgreSQL Database** - Drizzle ORM with type safety
- **WebSocket Support** - Real-time notifications
- **Session Management** - Secure authentication
- **File Upload Handling** - Multer integration
- **Process Management** - PM2 ecosystem configuration

### Frontend Features
- **React 18** - Modern React with hooks
- **Vite Build System** - Fast development and production builds
- **TypeScript** - Full type safety
- **Tailwind CSS** - Utility-first styling
- **Radix UI Components** - Accessible component library
- **React Query** - Server state management
- **React Hook Form** - Form handling with validation
- **Wouter** - Lightweight routing
- **Framer Motion** - Smooth animations
- **WebSocket Client** - Real-time updates

## 🌐 Environment Configuration

### Backend Environment (.env)
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/db
OPENAI_API_KEY=sk-your_key_here
GEMINI_API_KEY=your_key_here
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
```

### Frontend Environment
Frontend uses Vite proxy configuration to connect to backend API at `localhost:3001`

## 🔗 Integration Points

### API Communication
- **Backend Port**: 3001
- **Frontend Port**: 5173 (development)
- **WebSocket**: /ws endpoint
- **API Base**: /api

### Database Schema
- Shared schema definitions in `@shared/schema.ts`
- Automatic type generation with Drizzle
- Migration support with `npm run db:push`

## 🛠️ Development Commands

### Backend Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:push      # Push database schema
npm run db:studio    # Open Drizzle Studio
```

### Frontend Development
```bash
npm run dev          # Start Vite dev server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

## 📦 Production Deployment

### Using PM2 (Backend)
```bash
cd NEW/system/backend
npm run build
pm2 start ecosystem.config.js
```

### Using Static Hosting (Frontend)
```bash
cd NEW/system/frontend
npm run build
# Deploy 'dist' folder to static hosting
```

### Using Docker
Each component includes Dockerfile for containerized deployment:

```bash
# Backend
docker build -t crm-backend ./NEW/system/backend
docker run -p 3001:3001 crm-backend

# Frontend
docker build -t crm-frontend ./NEW/system/frontend
docker run -p 80:80 crm-frontend
```

## 🔒 Security Features

### Backend Security
- JWT-based authentication
- Session security with express-session
- CORS protection
- Input validation with Zod
- Secure file upload handling
- Environment variable protection

### Frontend Security
- XSS protection with React
- Secure API communication
- Input sanitization
- Protected routes
- Secure token storage

## 📊 Monitoring & Logging

### Backend Monitoring
- PM2 process monitoring
- Application logs in `./logs/`
- Database connection monitoring
- WhatsApp session status tracking

### Frontend Monitoring
- React Query devtools
- Error boundary handling
- Performance monitoring
- Real-time connection status

## 🔄 Update Process

### Backend Updates
```bash
git pull origin main
npm install
npm run build
pm2 restart crm-whatsapp-ai-backend
```

### Frontend Updates
```bash
git pull origin main
npm install
npm run build
# Deploy new build to static hosting
```

This modular structure allows for flexible deployment scenarios, from monolithic installations to microservice architectures, while maintaining complete functionality and integration capabilities.