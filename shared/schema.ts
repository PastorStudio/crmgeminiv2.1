import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, doublePrecision, real, date, decimal } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("fullName"),
  email: text("email"),
  role: text("role").default("agent"),
  status: text("status").default("active"),
  avatar: text("avatar"),
  department: text("department"),
  supervisorId: integer("supervisorId"),
  settings: jsonb("settings"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedat"),
});

// WhatsApp Accounts
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ownerName: text("ownerName"),
  ownerPhone: text("ownerPhone"),
  sessionData: jsonb("sessionData"),
  status: text("status").default("inactive"),
  adminId: integer("adminId"),
  assignedExternalAgentId: text("assignedExternalAgentId"),
  autoResponseEnabled: boolean("autoResponseEnabled").default(false),
  responseDelay: integer("responseDelay").default(3),
  createdAt: timestamp("createdAt").defaultNow(),
  lastActiveAt: timestamp("lastActiveAt"),
});

// Contactos - información centralizada de contactos
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  company: text("company"),
  position: text("position"),
  whatsappProfile: jsonb("whatsappProfile"), // Foto, estado, etc.
  location: text("location"),
  tags: text("tags").array(),
  customFields: jsonb("customFields"),
  lastSeen: timestamp("lastSeen"),
  source: text("source").default("whatsapp"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Leads del Sales Pipeline
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  contactId: integer("contactId").notNull(),
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  title: text("title").notNull(),
  status: text("status").default("new"), // new, contacted, qualified, proposal, negotiation, won, lost
  stage: text("stage").default("lead"), // lead, opportunity, quote, deal
  value: decimal("value", { precision: 10, scale: 2 }),
  currency: text("currency").default("USD"),
  probability: integer("probability").default(0), // 0-100
  priority: text("priority").default("medium"), // low, medium, high, urgent
  source: text("source").default("whatsapp"),
  assignedTo: integer("assignedTo"), // Usuario asignado
  expectedCloseDate: date("expectedCloseDate"),
  actualCloseDate: date("actualCloseDate"),
  lastContactDate: timestamp("lastContactDate"),
  nextFollowUpDate: timestamp("nextFollowUpDate"),
  notes: text("notes"),
  tags: text("tags").array(),
  customFields: jsonb("customFields"),
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
  urgency: text("urgency"), // low, medium, high
  topics: text("topics").array(),
  leadPotential: integer("leadPotential").default(0), // 0-100
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Mensajes individuales con análisis de IA
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversationId").notNull(),
  contactId: integer("contactId"),
  whatsappAccountId: integer("whatsappAccountId").notNull(),
  messageId: text("messageId").notNull().unique(), // ID único de WhatsApp
  fromNumber: text("fromNumber").notNull(),
  toNumber: text("toNumber").notNull(),
  content: text("content"),
  messageType: text("messageType").default("text"), // text, image, audio, video, document
  direction: text("direction").notNull(), // inbound, outbound
  isFromBot: boolean("isFromBot").default(false),
  mediaUrl: text("mediaUrl"),
  metadata: jsonb("metadata"),
  aiAnalysis: jsonb("aiAnalysis"), // Análisis de contenido por IA
  sentiment: text("sentiment"),
  intent: text("intent"),
  entities: jsonb("entities"), // Entidades extraídas (nombres, fechas, etc.)
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

// Activities (tabla única consolidada)
export const activities = pgTable("activities", {
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

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId"),
  content: text("content").notNull(),
  direction: text("direction").notNull(),
  channel: text("channel").notNull(),
  read: boolean("read").default(false),
  sentAt: timestamp("sentAt").defaultNow(),
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

// Relaciones
export const usersRelations = relations(users, ({ one, many }) => ({
  supervisor: one(users, {
    fields: [users.supervisorId],
    references: [users.id],
    relationName: "supervisor"
  }),
  assignedChats: many(chatAssignments),
  assignedTickets: many(modernTickets),
  createdTickets: many(modernTickets),
  comments: many(chatComments),
  notifications: many(notifications),
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
    fields: [leads.assigneeId],
    references: [users.id]
  }),
  activities: many(activities),
  messages: many(messages),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id]
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
    relationName: "userActivities"
  })
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id]
  })
}));

// Esquemas de inserción
export const insertAiSettingsSchema = createInsertSchema(aiSettings).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatAssignmentSchema = createInsertSchema(chatAssignments).omit({ id: true, assignedAt: true, lastActivityAt: true });
export const insertChatCommentSchema = createInsertSchema(chatComments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertModernTicketSchema = createInsertSchema(modernTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAutoResponseConfigSchema = createInsertSchema(autoResponseConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationAnalyticsSchema = createInsertSchema(conversationAnalytics).omit({ id: true, lastAnalyzed: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertWhatsAppAccountSchema = createInsertSchema(whatsappAccounts).omit({ id: true, createdAt: true, lastActiveAt: true });

// Tipos de TypeScript
export type AiSettings = typeof aiSettings.$inferSelect;
export type InsertAiSettings = typeof insertAiSettingsSchema._type;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof insertUserSchema._type;
export type ChatAssignment = typeof chatAssignments.$inferSelect;
export type InsertChatAssignment = typeof insertChatAssignmentSchema._type;
export type ChatComment = typeof chatComments.$inferSelect;
export type InsertChatComment = typeof insertChatCommentSchema._type;
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