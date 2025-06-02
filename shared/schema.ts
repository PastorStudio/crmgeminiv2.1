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

// Leads
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  source: text("source"),
  status: text("status").default("new"),
  notes: text("notes"),
  assigneeId: integer("assigneeId"),
  budget: doublePrecision("budget"),
  priority: text("priority"),
  tags: text("tags").array(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Activities
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