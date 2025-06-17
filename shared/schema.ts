import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, doublePrecision, real, date, decimal, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("USD"),
  durationDays: integer("duration_days").notNull(),
  features: jsonb("features"), // Array of features included
  maxUsers: integer("max_users").default(1),
  maxWhatsAppAccounts: integer("max_whatsapp_accounts").default(1),
  maxChatsPerMonth: integer("max_chats_per_month").default(1000),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User subscriptions table
export const userSubscriptions = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  startDate: timestamp("start_date").defaultNow(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").default("active"), // active, expired, suspended, cancelled
  autoRenewal: boolean("auto_renewal").default(false),
  assignedBy: integer("assigned_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat interventions table for managing manual intervention pauses
export const chatInterventions = pgTable("chat_interventions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  accountId: integer("account_id").notNull().references(() => whatsappAccounts.id),
  chatId: text("chat_id").notNull(),
  interventionAt: timestamp("intervention_at").defaultNow(),
  pauseUntil: timestamp("pause_until").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Universal tags system for all entities
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  color: text("color").default("#3B82F6"), // Hex color for visual identification
  description: text("description"),
  category: text("category").default("general"), // general, priority, status, custom
  isSystem: boolean("is_system").default(false), // System tags cannot be deleted
  userId: integer("user_id").references(() => users.id), // NULL for system tags
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tag assignments for leads
export const leadTags = pgTable("lead_tags", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Tag assignments for contacts
export const contactTags = pgTable("contact_tags", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Tag assignments for tickets
export const ticketTags = pgTable("ticket_tags", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: integer("assigned_by").references(() => users.id),
});

// Enhanced media storage for WhatsApp multimedia
export const mediaFiles = pgTable("media_files", {
  id: serial("id").primaryKey(),
  messageId: text("message_id").references(() => whatsappMessages.messageId),
  fileName: text("file_name").notNull(),
  originalName: text("original_name"),
  fileType: text("file_type").notNull(), // image, video, audio, document
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size"), // in bytes
  filePath: text("file_path").notNull(), // Local storage path
  fileUrl: text("file_url"), // Public access URL
  thumbnailPath: text("thumbnail_path"), // For images/videos
  duration: integer("duration"), // For audio/video in seconds
  dimensions: jsonb("dimensions"), // {width, height} for images/videos
  metadata: jsonb("metadata"), // Additional file metadata
  isProcessed: boolean("is_processed").default(false),
  accountId: integer("account_id").notNull().references(() => whatsappAccounts.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Demo users table for trial accounts created by the agent
export const demoUsers = pgTable("demo_users", {
  id: serial("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  chatId: text("chat_id"), // WhatsApp chat where demo was requested
  requestedAt: timestamp("requested_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").default("active"), // active, expired, converted, cancelled
  convertedToUserId: integer("converted_to_user_id").references(() => users.id),
  convertedAt: timestamp("converted_at"),
  createdBy: text("created_by").default("agent"), // agent, admin, system
  notes: text("notes"),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Base user table with role-based access
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("fullName"),
  email: text("email"),
  role: text("role").default("agent"), // admin, manager, agent, readonly, demo
  status: text("status").default("active"),
  isActive: boolean("is_active").default(true),
  avatar: text("avatar"),
  department: text("department"),
  supervisorId: integer("supervisorId"),
  organizationId: integer("organizationId"), // Multi-tenant support
  permissions: jsonb("permissions"), // Custom permissions array
  assignedAccounts: text("assignedAccounts").array(), // WhatsApp accounts assigned to user
  settings: jsonb("settings"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Organizations for multi-tenant support
export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  settings: jsonb("settings"),
  plan: text("plan").default("basic"), // basic, premium, enterprise
  status: text("status").default("active"),
  maxUsers: integer("maxUsers").default(5),
  maxAccounts: integer("maxAccounts").default(2),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// User-WhatsApp account assignments
export const userAccountAssignments = pgTable("user_account_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  whatsappAccountId: integer("whatsappAccountId").notNull().references(() => whatsappAccounts.id),
  role: text("role").default("operator"), // owner, manager, operator, readonly
  permissions: jsonb("permissions"), // Specific permissions for this account
  assignedAt: timestamp("assignedAt").defaultNow(),
  assignedBy: integer("assignedBy").references(() => users.id),
  isActive: boolean("isActive").default(true),
});

// AI Prompts for WhatsApp accounts
export const aiPrompts = pgTable("ai_prompts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  provider: text("provider").notNull().default("gemini"), // gemini, openai, qwen3
  temperature: real("temperature").default(0.7),
  maxTokens: integer("max_tokens").default(1000),
  model: text("model").default("gpt-4o"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// WhatsApp Accounts with organization support
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerName: text("ownername"),
  ownerPhone: text("ownerphone"),
  sessionData: jsonb("sessiondata"),
  status: text("status").default("inactive"),
  adminId: integer("adminid"),
  userId: integer("user_id").notNull().references(() => users.id), // User-based data isolation
  organizationId: integer("organizationId").references(() => organizations.id), // Multi-tenant support
  assignedExternalAgentId: text("assignedexternalagentid"),
  autoResponseEnabled: boolean("autoresponseenabled").default(false),
  responseDelay: integer("responsedelay").default(3),
  disableGroupResponses: boolean("disablegroupresponses").default(false),
  customPrompt: text("customprompt"),
  assignedPromptId: integer("assigned_prompt_id").references(() => aiPrompts.id),
  // Language and translation settings
  targetLanguage: text("target_language").default("es"), // Primary response language
  translateToSpanish: boolean("translate_to_spanish").default(true), // Show Spanish translation
  languageSettings: jsonb("language_settings"), // Additional language configuration
  keepAliveEnabled: boolean("keepaliveenabled").default(true),
  lastActivity: timestamp("lastactivity"),
  connectionAttempts: integer("connectionattempts").default(0),
  maxReconnectAttempts: integer("maxreconnectattempts").default(5),
  createdAt: timestamp("createdat").defaultNow(),
  lastActiveAt: timestamp("lastactiveat"),
});

// Contactos - información centralizada de contactos
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  company: text("company"),
  position: text("position"),
  whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccounts.id),
  whatsappProfile: jsonb("whatsappProfile"), // Foto, estado, etc.
  location: text("location"),
  tags: text("tags").array(),
  customFields: jsonb("customFields"),
  lastSeen: timestamp("lastSeen"),
  source: text("source").default("whatsapp"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Enhanced Leads database with persistent storage
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  uuid: text("uuid").notNull().unique(), // Unique identifier for external references
  contactId: integer("contactId").notNull(),
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  chatId: text("chatId"), // WhatsApp chat reference
  title: text("title").notNull(),
  name: text("name").notNull(),
  fullName: text("fullName"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  // Sales pipeline stages
  status: text("status").default("nuevo"), // nuevo, contactado, calificado, propuesta, negociacion, ganado, perdido
  stage: text("stage").default("prospecto"), // prospecto, oportunidad, cotizacion, cierre
  subStage: text("sub_stage"), // Sub-etapas personalizables
  value: decimal("value", { precision: 10, scale: 2 }).default('0.00'),
  budget: decimal("budget", { precision: 10, scale: 2 }), // Budget declared by lead
  currency: text("currency").default("USD"),
  probability: integer("probability").default(0), // 0-100
  priority: text("priority").default("medio"), // bajo, medio, alto, urgente
  source: text("source").default("whatsapp"),
  campaign: text("campaign"), // Marketing campaign source
  referral: text("referral"), // Referral source
  // Assignment and management
  assignedTo: integer("assignedTo"),
  assignedAt: timestamp("assignedAt"),
  assignedBy: integer("assignedBy"),
  teamId: integer("teamId"), // Team assignment
  // Dates and timeline
  expectedCloseDate: date("expectedCloseDate"),
  actualCloseDate: date("actualCloseDate"),
  firstContactDate: timestamp("firstContactDate"),
  lastContactDate: timestamp("lastContactDate"),
  nextFollowUpDate: timestamp("nextFollowUpDate"),
  lastActivityDate: timestamp("lastActivityDate"),
  // Lead scoring and qualification
  leadScore: integer("leadScore").default(0), // 0-100 automated scoring
  qualificationLevel: text("qualificationLevel").default("no_calificado"), // no_calificado, calificado, muy_calificado
  interests: text("interests").array(), // Products/services of interest
  requirements: text("requirements"), // Specific requirements
  decision_maker: boolean("decision_maker").default(false),
  // Communication preferences
  preferredContactMethod: text("preferredContactMethod").default("whatsapp"),
  bestTimeToContact: text("bestTimeToContact"),
  timezone: text("timezone"),
  language: text("language").default("es"),
  // Additional information
  notes: text("notes"),
  privateNotes: text("privateNotes"), // Internal notes only
  tags: text("tags").array(),
  customFields: jsonb("customFields"),
  metadata: jsonb("metadata"), // Additional structured data
  // AI analysis
  aiAnalysis: jsonb("aiAnalysis"), // AI conversation analysis
  sentiment: text("sentiment"), // positive, negative, neutral
  intent: text("intent"), // buying_intent, information_seeking, support
  topics: text("topics").array(), // Conversation topics
  // Work and progress tracking
  workProgress: jsonb("workProgress"), // Track work done on this lead
  workSessions: integer("workSessions").default(0), // Number of work sessions
  lastWorkSession: timestamp("lastWorkSession"), // Last time work was done
  progressNotes: text("progressNotes"), // Detailed progress tracking
  // Performance metrics
  responseTime: integer("responseTime"), // Average response time in minutes
  engagementLevel: text("engagementLevel").default("bajo"), // bajo, medio, alto
  conversionProbability: integer("conversionProbability").default(0), // AI-calculated probability
  matchPercentage: integer("matchPercentage").default(0),
  // Status tracking
  isActive: boolean("isActive").default(true),
  isConverted: boolean("isConverted").default(false),
  isDeleted: boolean("isDeleted").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Tickets de soporte/interés
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  contactId: integer("contactId").notNull(),
  leadId: integer("leadId"), // Opcional, si está relacionado a un lead
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").default("inquiry"), // inquiry, support, complaint, follow_up
  status: text("status").default("open"), // open, in_progress, pending, resolved, closed
  priority: text("priority").default("medium"), // low, medium, high, urgent
  category: text("category"),
  assignedTo: integer("assignedTo"),
  resolutionNotes: text("resolutionNotes"),
  estimatedResolutionTime: integer("estimatedResolutionTime"), // en minutos
  actualResolutionTime: integer("actualResolutionTime"),
  tags: text("tags").array(),
  customFields: jsonb("customFields"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});

// Conversaciones de WhatsApp con análisis automático
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  contactId: integer("contactId").notNull(),
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  leadId: integer("leadId"), // Si la conversación genera un lead
  ticketId: integer("ticketId"), // Si la conversación genera un ticket
  chatId: text("chatId").notNull(), // ID único del chat de WhatsApp
  title: text("title"),
  status: text("status").default("active"), // active, archived, closed
  lastMessageAt: timestamp("lastMessageAt"),
  messageCount: integer("messageCount").default(0),
  isGroup: boolean("isGroup").default(false),
  participants: jsonb("participants"), // Para chats grupales
  aiAnalysis: jsonb("aiAnalysis"), // Análisis automático de la IA
  sentiment: text("sentiment"), // positive, negative, neutral
  intent: text("intent"), // sales, support, inquiry, complaint
  messages: text("messages"), // JSON string de mensajes para análisis
  analyzed: boolean("analyzed").default(false),
  analysisData: jsonb("analysisData"),
  analyzedAt: timestamp("analyzedAt"),
  urgency: text("urgency"), // low, medium, high
  topics: text("topics").array(),
  leadPotential: integer("leadPotential").default(0), // 0-100
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// WhatsApp Messages table for independent auto-response
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("accountId").notNull(),
  chatId: text("chatId").notNull(),
  messageId: text("messageId").notNull().unique(),
  content: text("content"),
  from_me: boolean("from_me").default(false),
  timestamp: timestamp("timestamp").notNull(),
  hasMedia: boolean("hasMedia").default(false),
  mediaType: text("mediaType"),
  mediaUrl: text("mediaUrl"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Enhanced messages table with AI analysis
export const enhancedMessages = pgTable("enhanced_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId"),
  contactId: integer("contactId"),
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  messageId: text("messageId").notNull().unique(),
  fromNumber: text("fromNumber").notNull(),
  toNumber: text("toNumber").notNull(),
  content: text("content"),
  messageType: text("messageType").default("text"),
  direction: text("direction").notNull(),
  isFromBot: boolean("isFromBot").default(false),
  mediaUrl: text("mediaUrl"),
  metadata: jsonb("metadata"),
  aiAnalysis: jsonb("aiAnalysis"),
  sentiment: text("sentiment"),
  intent: text("intent"),
  entities: jsonb("entities"),
  isProcessed: boolean("isProcessed").default(false),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Pipeline de ventas - etapas personalizables
export const salesPipeline = pgTable("sales_pipeline", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  stages: jsonb("stages"), // Array de etapas configurables
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true),
  createdBy: integer("createdBy"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Actividades y seguimientos automáticos
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // call, email, whatsapp, meeting, note, task
  contactId: integer("contactId"),
  leadId: integer("leadId"),
  ticketId: integer("ticketId"),
  conversationId: integer("conversationId"),
  userId: integer("userId"), // Usuario que realizó la actividad
  title: text("title").notNull(),
  description: text("description"),
  outcome: text("outcome"), // completed, scheduled, cancelled, no_answer
  duration: integer("duration"), // en minutos
  scheduledAt: timestamp("scheduledAt"),
  completedAt: timestamp("completedAt"),
  metadata: jsonb("metadata"),
  isAutomated: boolean("isAutomated").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Enhanced activities for autonomous system
export const enhancedActivities = pgTable("enhanced_activities", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  userId: integer("userId"),
  type: text("type").notNull(),
  scheduled: timestamp("scheduled").notNull(),
  notes: text("notes"),
  completed: boolean("completed").default(false),
  priority: text("priority"),
  reminder: timestamp("reminder"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Enhanced messages for autonomous system
export const enhancedMessagesTable = pgTable("enhanced_messages_table", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  content: text("content").notNull(),
  direction: text("direction").notNull(),
  channel: text("channel").notNull(),
  read: boolean("read").default(false),
  sentAt: timestamp("sentAt").defaultNow(),
});

// Agent page visits tracking
export const agentPageVisits = pgTable("agent_page_visits", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull(),
  page: text("page").notNull(),
  action: text("action").notNull().default("page_view"),
  details: text("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Dashboard Stats
export const dashboardStats = pgTable("dashboard_stats", {
  id: serial("id").primaryKey(),
  totalLeads: integer("totalLeads").default(0),
  newLeadsThisMonth: integer("newLeadsThisMonth").default(0),
  activeLeads: integer("activeLeads").default(0),
  convertedLeads: integer("convertedLeads").default(0),
  totalSales: doublePrecision("totalSales").default(0),
  salesThisMonth: doublePrecision("salesThisMonth").default(0),
  pendingActivities: integer("pendingActivities").default(0),
  completedActivities: integer("completedActivities").default(0),
  performanceMetrics: jsonb("performanceMetrics").default('{"responseTime": 0, "conversionRate": 0, "customerSatisfaction": 0}'),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Chat Assignments - Sistema moderno
export const chatAssignments = pgTable('chat_assignments', {
  id: serial('id').primaryKey(),
  chatId: text('chatId').notNull().unique(),
  accountId: integer('accountId'),
  assignedToId: integer('assignedToId'),
  assignedAt: timestamp('assignedAt').defaultNow(),
  assignedById: integer('assignedById'),
  status: text('status').default('active'),
  priority: text('priority').default('medium'),
  category: text('category'),
  notes: text('notes'),
  lastActivityAt: timestamp('lastActivityAt').defaultNow(),
});

// Chat Comments
export const chatComments = pgTable('chat_comments', {
  id: serial('id').primaryKey(),
  chatId: text('chatId').notNull(),
  accountId: integer('accountId'),
  userId: integer('userId'),
  content: text('content').notNull(),
  isPrivate: boolean('isPrivate').default(true),
  mentions: text('mentions').array(),
  attachments: jsonb('attachments'),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt'),
});

// Lead Comments
export const leadComments = pgTable('lead_comments', {
  id: serial('id').primaryKey(),
  leadId: integer('leadId').notNull().references(() => leads.id),
  userId: integer('userId').references(() => users.id),
  comment: text('comment').notNull(),
  authorName: text('authorName').default('Sistema'),
  isPrivate: boolean('isPrivate').default(true),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt'),
});

// Conversations table already exists above (line 130), using the existing one

// Analysis Reports - reportes de análisis de IA
export const analysisReports = pgTable("analysis_reports", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  chatId: text("chatId").notNull(),
  accountId: integer("accountId").notNull(),
  analysisType: text("analysisType").notNull(), // conversation_intent, lead_extraction, ticket_analysis
  analysisData: jsonb("analysisData").notNull(),
  leadPotential: integer("leadPotential"), // 0-100
  urgency: text("urgency"), // low, medium, high
  category: text("category"),
  sentiment: text("sentiment"), // positive, neutral, negative
  actionRequired: boolean("actionRequired").default(false),
  leadGenerated: boolean("leadGenerated").default(false),
  ticketGenerated: boolean("ticketGenerated").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Modern Tickets
export const modernTickets = pgTable('modern_tickets', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  accountId: integer('account_id'),
  assignedToId: integer('assigned_to_id'),
  createdById: integer('created_by_id'),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('open'),
  priority: text('priority').default('medium'),
  category: text('category'),
  tags: text('tags').array(),
  dueDate: timestamp('due_date'),
  estimatedHours: decimal('estimated_hours', { precision: 4, scale: 2 }),
  actualHours: decimal('actual_hours', { precision: 4, scale: 2 }),
  customerInfo: jsonb('customer_info'),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
  resolvedAt: timestamp('resolved_at'),
});

// Auto Response Configs
export const autoResponseConfigs = pgTable('auto_response_configs', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id'),
  enabled: boolean('enabled').default(false),
  aiProvider: text('ai_provider').default('gemini'),
  responseDelay: integer('response_delay').default(5),
  workingHours: jsonb('working_hours'),
  triggers: text('triggers').array(),
  excludeKeywords: text('exclude_keywords').array(),
  maxResponsesPerDay: integer('max_responses_per_day').default(50),
  personalityPrompt: text('personality_prompt'),
  contextWindow: integer('context_window').default(10),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at'),
});

// Conversation Analytics
export const conversationAnalytics = pgTable('conversation_analytics', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  accountId: integer('account_id'),
  messageCount: integer('message_count').default(0),
  responseTime: integer('response_time'),
  sentiment: text('sentiment'),
  sentimentScore: decimal('sentiment_score', { precision: 3, scale: 2 }),
  intent: text('intent'),
  keywords: text('keywords').array(),
  topics: text('topics').array(),
  conversionProbability: decimal('conversion_probability', { precision: 3, scale: 2 }),
  lastAnalyzed: timestamp('last_analyzed').defaultNow(),
  aiInsights: jsonb('ai_insights'),
  salesStage: text('sales_stage'),
  customerValue: decimal('customer_value', { precision: 10, scale: 2 }),
});

// Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  read: boolean('read').default(false),
  priority: text('priority').default('normal'),
  actionUrl: text('action_url'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

// AI Configuration Settings
export const aiSettings = pgTable('ai_settings', {
  id: serial('id').primaryKey(),
  selectedProvider: text('selected_provider').default('gemini').notNull(),
  geminiApiKey: text('gemini_api_key'),
  openaiApiKey: text('openai_api_key'),
  qwenApiKey: text('qwen_api_key'),
  customPrompt: text('custom_prompt').default('Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.'),
  temperature: real('temperature').default(0.7),
  enableAIResponses: boolean('enable_ai_responses').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// External Agents
export const externalAgents = pgTable('external_agents', {
  id: text('id').primaryKey(),
  chatId: text('chat_id'),
  accountId: integer('account_id').default(0),
  agentName: text('agent_name').notNull(),
  agentUrl: text('agent_url').notNull(),
  provider: text('provider').default('openai').notNull(),
  status: text('status').default('active').notNull(),
  lastUsed: timestamp('last_used'),
  responseCount: integer('response_count').default(0),
  averageResponseTime: integer('average_response_time').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Agent Metrics (para tickets)
export const agentMetrics = pgTable('agent_metrics', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  totalTickets: integer('total_tickets').default(0),
  resolvedTickets: integer('resolved_tickets').default(0),
  averageResponseTime: integer('average_response_time').default(0),
  customerSatisfaction: real('customer_satisfaction').default(0),
  activeTickets: integer('active_tickets').default(0),
  date: date('date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Message Activity (para tickets)
export const messageActivity = pgTable('message_activity', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  accountId: integer('account_id').notNull(),
  messageCount: integer('message_count').default(0),
  lastMessageAt: timestamp('last_message_at'),
  isActive: boolean('is_active').default(true),
  priority: text('priority').default('normal'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Calendar Events
export const calendarEvents = pgTable('calendar_events', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id'),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date').notNull(),
  reminderMinutes: integer('reminder_minutes').default(30),
  eventType: text('event_type').default('reminder'),
  contactPhone: text('contact_phone'),
  whatsappAccountId: integer('whatsapp_account_id'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Local Events (compatible with existing database structure)
export const localEvents = pgTable('local_events', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id'),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: timestamp('event_date').notNull(),
  reminderMinutes: integer('reminder_minutes').default(30),
  eventType: text('event_type').default('reminder'),
  contactPhone: text('contact_phone'),
  whatsappAccountId: integer('whatsapp_account_id'),
  status: text('status').default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Relaciones with multi-tenant support
export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id]
  }),
  supervisor: one(users, {
    fields: [users.supervisorId],
    references: [users.id],
    relationName: "supervisor"
  }),
  subordinates: many(users, { relationName: "supervisor" }),
  accountAssignments: many(userAccountAssignments),
  assignedLeads: many(leads),
  activities: many(enhancedActivities),
  assignedChats: many(chatAssignments),
  assignedTickets: many(modernTickets),
  createdTickets: many(modernTickets),
  comments: many(chatComments),
  notifications: many(notifications),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  whatsappAccounts: many(whatsappAccounts),
}));

export const userAccountAssignmentsRelations = relations(userAccountAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userAccountAssignments.userId],
    references: [users.id]
  }),
  whatsappAccount: one(whatsappAccounts, {
    fields: [userAccountAssignments.whatsappAccountId],
    references: [whatsappAccounts.id]
  }),
  assignedBy: one(users, {
    fields: [userAccountAssignments.assignedBy],
    references: [users.id],
    relationName: "assignmentCreator"
  }),
}));

export const whatsappAccountsRelations = relations(whatsappAccounts, ({ one, many }) => ({
  admin: one(users, {
    fields: [whatsappAccounts.adminId],
    references: [users.id]
  }),
  chatAssignments: many(chatAssignments),
  chatComments: many(chatComments),
  tickets: many(modernTickets),
  autoResponseConfig: one(autoResponseConfigs),
  analytics: many(conversationAnalytics),
}));

export const chatAssignmentsRelations = relations(chatAssignments, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [chatAssignments.accountId],
    references: [whatsappAccounts.id]
  }),
  assignedTo: one(users, {
    fields: [chatAssignments.assignedToId],
    references: [users.id],
    relationName: "assignedChats"
  }),
  assignedBy: one(users, {
    fields: [chatAssignments.assignedById],
    references: [users.id],
    relationName: "assignedByUser"
  })
}));

export const chatCommentsRelations = relations(chatComments, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [chatComments.accountId],
    references: [whatsappAccounts.id]
  }),
  user: one(users, {
    fields: [chatComments.userId],
    references: [users.id]
  })
}));

export const modernTicketsRelations = relations(modernTickets, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [modernTickets.accountId],
    references: [whatsappAccounts.id]
  }),
  assignedTo: one(users, {
    fields: [modernTickets.assignedToId],
    references: [users.id],
    relationName: "ticketAssignee"
  }),
  createdBy: one(users, {
    fields: [modernTickets.createdById],
    references: [users.id],
    relationName: "ticketCreator"
  })
}));

export const autoResponseConfigsRelations = relations(autoResponseConfigs, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [autoResponseConfigs.accountId],
    references: [whatsappAccounts.id]
  })
}));

export const conversationAnalyticsRelations = relations(conversationAnalytics, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [conversationAnalytics.accountId],
    references: [whatsappAccounts.id]
  })
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignee: one(users, {
    fields: [leads.assignedTo],
    references: [users.id]
  }),
  activities: many(enhancedActivities),
  messages: many(enhancedMessagesTable),
}));

export const activitiesRelations = relations(enhancedActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [enhancedActivities.leadId],
    references: [leads.id]
  }),
  user: one(users, {
    fields: [enhancedActivities.userId],
    references: [users.id],
    relationName: "userActivities"
  })
}));

export const enhancedMessagesRelations = relations(enhancedMessagesTable, ({ one }) => ({
  lead: one(leads, {
    fields: [enhancedMessagesTable.leadId],
    references: [leads.id]
  })
}));

// Esquemas de inserción
export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const insertUserSubscriptionSchema = createInsertSchema(userSubscriptions);
export const insertAiPromptSchema = createInsertSchema(aiPrompts);
export const insertAiSettingsSchema = createInsertSchema(aiSettings);
export const insertChatAssignmentSchema = createInsertSchema(chatAssignments);
export const insertChatCommentSchema = createInsertSchema(chatComments);
export const insertLeadCommentSchema = createInsertSchema(leadComments);
export const insertModernTicketSchema = createInsertSchema(modernTickets);
export const insertAutoResponseConfigSchema = createInsertSchema(autoResponseConfigs);
export const insertConversationAnalyticsSchema = createInsertSchema(conversationAnalytics);
export const insertNotificationSchema = createInsertSchema(notifications);
export const insertUserSchema = createInsertSchema(users);
export const insertLeadSchema = createInsertSchema(leads);
export const insertWhatsAppAccountSchema = createInsertSchema(whatsappAccounts);
export const insertCalendarEventSchema = createInsertSchema(calendarEvents);
export const insertLocalEventSchema = createInsertSchema(localEvents);

// Tipos de TypeScript
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof insertSubscriptionPlanSchema._type;
export type UserSubscription = typeof userSubscriptions.$inferSelect;
export type InsertUserSubscription = typeof insertUserSubscriptionSchema._type;
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = typeof insertAiSettingsSchema._type;
export type User = typeof users.$inferSelect & {
  currentPlan?: string | null;
  currentPlanId?: number | null;
  daysRemaining?: number | null;
  subscriptionEndDate?: Date | null;
  subscriptionStatus?: string | null;
};
export type InsertUser = typeof insertUserSchema._type;
export type ChatAssignment = typeof chatAssignments.$inferSelect;
export type InsertChatAssignment = typeof insertChatAssignmentSchema._type;
export type ChatComment = typeof chatComments.$inferSelect;
export type InsertChatComment = typeof insertChatCommentSchema._type;
export type LeadComment = typeof leadComments.$inferSelect;
export type InsertLeadComment = typeof insertLeadCommentSchema._type;
export type ModernTicket = typeof modernTickets.$inferSelect;
export type InsertModernTicket = typeof insertModernTicketSchema._type;
export type AutoResponseConfig = typeof autoResponseConfigs.$inferSelect;
export type InsertAutoResponseConfig = typeof insertAutoResponseConfigSchema._type;
export type ConversationAnalytics = typeof conversationAnalytics.$inferSelect;
export type InsertConversationAnalytics = typeof insertConversationAnalyticsSchema._type;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof insertNotificationSchema._type;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof insertLeadSchema._type;
export type WhatsAppAccount = typeof whatsappAccounts.$inferSelect;
export type InsertWhatsAppAccount = typeof insertWhatsAppAccountSchema._type;
export type ExternalAgent = typeof externalAgents.$inferSelect;
export type AiPrompt = typeof aiPrompts.$inferSelect;
export type InsertAiPrompt = typeof insertAiPromptSchema._type;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof insertCalendarEventSchema._type;
export type LocalEvent = typeof localEvents.$inferSelect;
export type InsertLocalEvent = typeof insertLocalEventSchema._type;
export type SalesFlow = typeof salesFlows.$inferSelect;
export type InsertSalesFlow = typeof insertSalesFlowStageSchema._type;

// Sales Flow Tables
export const salesFlowStages = pgTable("sales_flow_stages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  order: integer("order").notNull(),
  color: text("color").default("#3B82F6"),
  icon: text("icon").default("circle"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const flowNodes = pgTable("flow_nodes", {
  id: serial("id").primaryKey(),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  position: jsonb("position"),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const flowConnections = pgTable("flow_connections", {
  id: serial("id").primaryKey(),
  sourceNodeId: integer("source_node_id").references(() => flowNodes.id),
  targetNodeId: integer("target_node_id").references(() => flowNodes.id),
  condition: text("condition"),
  label: text("label"),
  style: jsonb("style"),
  createdAt: timestamp("created_at").defaultNow()
});

// Tabla para flujos completos (desde plantillas)
export const salesFlows = pgTable("sales_flows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateId: text("template_id"),
  nodes: jsonb("nodes").notNull(),
  edges: jsonb("edges").notNull(),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const conversationFlowSessions = pgTable("conversation_flow_sessions", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  accountId: integer("account_id").notNull(),
  currentNodeId: integer("current_node_id").references(() => flowNodes.id),
  currentStageId: integer("current_stage_id").references(() => salesFlowStages.id),
  sessionData: jsonb("session_data"),
  isActive: boolean("is_active").default(true),
  startedAt: timestamp("started_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

// Schema para salesFlows - moverlo al final después de todas las tablas

export const flowExecutionLog = pgTable("flow_execution_log", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => conversationFlowSessions.id),
  nodeId: integer("node_id").references(() => flowNodes.id),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  action: text("action").notNull(),
  messageText: text("message_text"),
  aiResponse: text("ai_response"),
  executionTime: integer("execution_time"),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow()
});

export const salesMetrics = pgTable("sales_metrics", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  date: timestamp("date").defaultNow(),
  conversationsStarted: integer("conversations_started").default(0),
  conversationsCompleted: integer("conversations_completed").default(0),
  conversionRate: integer("conversion_rate").default(0),
  averageTime: integer("average_time").default(0),
  revenue: integer("revenue").default(0),
  createdAt: timestamp("created_at").defaultNow()
});



// User WhatsApp accounts association
export const userWhatsappAccounts = pgTable("user_whatsapp_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  accountId: integer("account_id").references(() => whatsappAccounts.id),
  role: text("role").default("agent"),
  permissions: jsonb("permissions"),
  createdAt: timestamp("created_at").defaultNow()
});

// Chat categories - replaced with enhanced version below

// Sales flow schema exports
export const insertSalesFlowStageSchema = createInsertSchema(salesFlowStages);
export const insertFlowNodeSchema = createInsertSchema(flowNodes);
export const insertFlowConnectionSchema = createInsertSchema(flowConnections);
export const insertConversationFlowSessionSchema = createInsertSchema(conversationFlowSessions);
export const insertFlowExecutionLogSchema = createInsertSchema(flowExecutionLog);
export const insertSalesMetricsSchema = createInsertSchema(salesMetrics);

// Sales flow types
export type SalesFlowStage = typeof salesFlowStages.$inferSelect;
export type FlowNode = typeof flowNodes.$inferSelect;
export type FlowConnection = typeof flowConnections.$inferSelect;
export type ConversationFlowSession = typeof conversationFlowSessions.$inferSelect;
export type FlowExecutionLog = typeof flowExecutionLog.$inferSelect;
export type SalesMetrics = typeof salesMetrics.$inferSelect;
export type InsertSalesFlowStage = typeof insertSalesFlowStageSchema._type;
export type InsertFlowNode = typeof insertFlowNodeSchema._type;
export type InsertFlowConnection = typeof insertFlowConnectionSchema._type;
export type InsertConversationFlowSession = typeof insertConversationFlowSessionSchema._type;
export type InsertFlowExecutionLog = typeof insertFlowExecutionLogSchema._type;
export type InsertSalesMetrics = typeof insertSalesMetricsSchema._type;



// Message Templates for mass messaging
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: text("category").default("general"),
  tags: text("tags").array().default([]),
  variables: jsonb("variables").default([]),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
  createdBy: integer("createdBy"),
  isActive: boolean("isActive").default(true),
});

// Message templates schemas
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates);
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof insertMessageTemplateSchema._type;

// Demo users schemas
export const insertDemoUserSchema = createInsertSchema(demoUsers);
export type DemoUser = typeof demoUsers.$inferSelect;
export type InsertDemoUser = typeof insertDemoUserSchema._type;

// Enhanced Chat Categories for message filtering (individuals, groups, unread)
export const chatCategories = pgTable("chat_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  icon: text("icon").default("folder"),
  category: text("category").notNull(), // individuals, groups, unread
  chatId: text("chat_id"), // Associated chat ID
  status: text("status").default("active"), // active, archived, hidden
  messageCount: integer("message_count").default(0),
  unreadCount: integer("unread_count").default(0),
  lastMessageAt: timestamp("last_message_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Real-time Analytics table for 5-second refresh system
export const realTimeAnalytics = pgTable("real_time_analytics", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  activeAgents: integer("active_agents").default(0),
  totalMessages: integer("total_messages").default(0),
  newLeads: integer("new_leads").default(0),
  convertedLeads: integer("converted_leads").default(0),
  activeChats: integer("active_chats").default(0),
  responseTime: decimal("response_time", { precision: 10, scale: 2 }).default('0.00'),
  systemLoad: decimal("system_load", { precision: 5, scale: 2 }).default('0.00'),
  accountsActive: integer("accounts_active").default(0),
  ticketsOpen: integer("tickets_open").default(0),
  revenue: decimal("revenue", { precision: 15, scale: 2 }).default('0.00'),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default('0.00'),
  aiProviderStatus: jsonb("ai_provider_status").default('{}'),
  geminiStatus: text("gemini_status").default("active"),
  systemHealth: text("system_health").default("healthy"),
  metadata: jsonb("metadata").default('{}'),
});

// Enhanced Security Control with detailed page/action tracking
export const securityActivityLog = pgTable("security_activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  agentId: integer("agent_id"),
  sessionId: text("session_id"),
  page: text("page").notNull(),
  action: text("action").notNull(),
  category: text("category").notNull(), // navigation, data_access, configuration, security, authentication
  specificAction: text("specific_action"), // login, logout, view_leads, create_lead, delete_user, etc
  targetResource: text("target_resource"), // specific resource being accessed
  resourceId: text("resource_id"), // ID of specific resource
  beforeState: jsonb("before_state"), // State before action
  afterState: jsonb("after_state"), // State after action
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  riskLevel: text("risk_level").default("low"), // low, medium, high, critical
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  duration: integer("duration"), // Action duration in milliseconds
  metadata: jsonb("metadata").default('{}'),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Mass messaging system with real chat list import
export const massMessageCampaigns = pgTable("mass_message_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  messageTemplate: text("message_template").notNull(),
  targetAudience: text("target_audience").notNull(), // all, leads, customers, specific_list
  chatList: jsonb("chat_list"), // Real imported chat list
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  errorCount: integer("error_count").default(0),
  status: text("status").default("draft"), // draft, scheduled, sending, completed, paused, cancelled
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdBy: integer("created_by").references(() => users.id),
  accountId: integer("account_id").references(() => whatsappAccounts.id),
  sendRate: integer("send_rate").default(10), // Messages per minute
  personalized: boolean("personalized").default(false),
  trackingEnabled: boolean("tracking_enabled").default(true),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily automated tasks system
export const automatedTasks = pgTable("automated_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull(), // daily_followup, lead_nurturing, reminder, report_generation
  frequency: text("frequency").default("daily"), // daily, weekly, monthly
  scheduleTime: text("schedule_time").default("09:00"), // HH:MM format
  targetCriteria: jsonb("target_criteria"), // Criteria for selecting targets
  actionTemplate: jsonb("action_template"), // Template for the action to perform
  isActive: boolean("is_active").default(true),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  runCount: integer("run_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  createdBy: integer("created_by").references(() => users.id),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event popup reminders with color coding (red=today, yellow=tomorrow)
export const eventReminders = pgTable("event_reminders", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => calendarEvents.id),
  userId: integer("user_id").references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  reminderTime: timestamp("reminder_time").notNull(),
  reminderType: text("reminder_type").default("popup"), // popup, notification, email
  colorCode: text("color_code").default("blue"), // red (today), yellow (tomorrow), blue (future)
  priority: text("priority").default("medium"), // low, medium, high, urgent
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"), // daily, weekly, monthly
  status: text("status").default("pending"), // pending, shown, dismissed, snoozed
  snoozeUntil: timestamp("snooze_until"),
  shownAt: timestamp("shown_at"),
  dismissedAt: timestamp("dismissed_at"),
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat to leads conversion tracking
export const chatToLeadConversions = pgTable("chat_to_lead_conversions", {
  id: serial("id").primaryKey(),
  chatId: text("chat_id").notNull(),
  leadId: integer("lead_id").references(() => leads.id),
  accountId: integer("account_id").references(() => whatsappAccounts.id),
  contactId: integer("contact_id").references(() => contacts.id),
  conversionTrigger: text("conversion_trigger"), // ai_analysis, manual, keyword_match, behavior_pattern
  conversionConfidence: decimal("conversion_confidence", { precision: 5, scale: 2 }).default('0.00'), // 0-100
  aiAnalysisData: jsonb("ai_analysis_data"),
  conversionReasons: text("conversion_reasons").array(),
  messagesSinceStart: integer("messages_since_start").default(0),
  conversationDuration: integer("conversation_duration"), // in minutes
  isAutomatic: boolean("is_automatic").default(false),
  convertedBy: integer("converted_by").references(() => users.id),
  reviewStatus: text("review_status").default("pending"), // pending, approved, rejected
  qualityScore: integer("quality_score"), // 1-10 lead quality
  metadata: jsonb("metadata").default('{}'),
  createdAt: timestamp("created_at").defaultNow(),
});

// Tag system schemas
export const insertTagSchema = createInsertSchema(tags);
export const insertLeadTagSchema = createInsertSchema(leadTags);
export const insertContactTagSchema = createInsertSchema(contactTags);
export const insertTicketTagSchema = createInsertSchema(ticketTags);
export const insertMediaFileSchema = createInsertSchema(mediaFiles);

// Additional validation schemas (avoiding duplicates)
export const insertContactSchema = createInsertSchema(contacts);
export const insertConversationSchema = createInsertSchema(conversations);
export const insertTicketSchema = createInsertSchema(tickets);
export const insertChatCategorySchema = createInsertSchema(chatCategories);
export const insertRealTimeAnalyticsSchema = createInsertSchema(realTimeAnalytics);
export const insertSecurityActivityLogSchema = createInsertSchema(securityActivityLog);
export const insertMassMessageCampaignSchema = createInsertSchema(massMessageCampaigns);
export const insertAutomatedTaskSchema = createInsertSchema(automatedTasks);
export const insertEventReminderSchema = createInsertSchema(eventReminders);
export const insertChatToLeadConversionSchema = createInsertSchema(chatToLeadConversions);

// Tag system types
export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof insertTagSchema._type;
export type LeadTag = typeof leadTags.$inferSelect;
export type InsertLeadTag = typeof insertLeadTagSchema._type;
export type ContactTag = typeof contactTags.$inferSelect;
export type InsertContactTag = typeof insertContactTagSchema._type;
export type TicketTag = typeof ticketTags.$inferSelect;
export type InsertTicketTag = typeof insertTicketTagSchema._type;
export type MediaFile = typeof mediaFiles.$inferSelect;
export type InsertMediaFile = typeof insertMediaFileSchema._type;