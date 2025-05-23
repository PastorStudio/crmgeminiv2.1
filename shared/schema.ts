import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, doublePrecision } from "drizzle-orm/pg-core";
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
  supervisorId: integer("supervisorId").references((): any => users.id),
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
  status: text("status").default("disconnected"),
  ownerName: text("ownerName"),
  ownerPhone: text("ownerPhone"),
  adminId: integer("adminId"),
  sessionData: jsonb("sessionData"),
  createdAt: timestamp("createdAt").defaultNow(),
  lastActiveAt: timestamp("lastActiveAt"),
});

// Leads/Prospects table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  source: text("source"),
  status: text("status").default("new"),
  notes: text("notes"),
  assigneeId: integer("assigneeId").references((): any => users.id),
  createdAt: timestamp("createdAt").defaultNow(),
  budget: doublePrecision("budget"),
  priority: text("priority").default("medium"),
  tags: text("tags").array(),
});

// Activities table
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  leadId: integer("leadId").references((): any => leads.id),
  userId: integer("userId").references((): any => users.id),
  dueDate: timestamp("dueDate"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completedAt"),
  priority: text("priority").default("medium"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  leadId: integer("leadId").references((): any => leads.id),
  sender: text("sender").notNull(),
  direction: text("direction").notNull(),
  channel: text("channel").default("whatsapp"),
  sentAt: timestamp("sentAt").defaultNow(),
  readAt: timestamp("readAt"),
  messageType: text("messageType").default("text"),
  metadata: jsonb("metadata"),
});

// Surveys table
export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  leadId: integer("leadId").references((): any => leads.id),
  questions: jsonb("questions").notNull(),
  responses: jsonb("responses"),
  status: text("status").default("pending"),
  sentAt: timestamp("sentAt").defaultNow(),
  completedAt: timestamp("completedAt"),
});

// Dashboard stats table
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
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Message templates table
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  category: text("category"),
  variables: text("variables").array(),
  createdBy: integer("createdBy").references((): any => users.id),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Marketing campaigns table
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateId: integer("templateId").references((): any => messageTemplates.id),
  targetAudience: jsonb("targetAudience"),
  schedule: jsonb("schedule"),
  status: text("status").default("draft"),
  stats: jsonb("stats"),
  createdBy: integer("createdBy").references((): any => users.id),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Media gallery table
export const mediaGallery = pgTable("media_gallery", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("originalName").notNull(),
  mimeType: text("mimeType").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  url: text("url"),
  description: text("description"),
  tags: text("tags").array(),
  uploadedBy: integer("uploadedBy").references((): any => users.id),
  uploadedAt: timestamp("uploadedAt").defaultNow(),
  lastUsedAt: timestamp("lastUsedAt"),
  useCount: integer("useCount").default(0),
});

// AI Configuration table
export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references((): any => users.id),
  provider: text("provider").notNull().default("gemini"),
  apiKey: text("apiKey"),
  model: text("model").default("gemini-pro"),
  temperature: doublePrecision("temperature").default(0.7),
  maxTokens: integer("maxTokens").default(1000),
  systemPrompt: text("systemPrompt"),
  isActive: boolean("isActive").default(true),
  settings: jsonb("settings"),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Time zone configuration table
export const timeZoneConfig = pgTable("time_zone_config", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references((): any => users.id),
  timeZone: text("timeZone").notNull().default("UTC"),
  dateFormat: text("dateFormat").default("YYYY-MM-DD"),
  timeFormat: text("timeFormat").default("HH:mm"),
  autoDetect: boolean("autoDetect").default(true),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// WhatsApp messages table
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("accountId").references((): any => whatsappAccounts.id),
  chatId: text("chatId").notNull(),
  messageId: text("messageId").notNull(),
  fromId: text("fromId").notNull(),
  toId: text("toId").notNull(),
  body: text("body"),
  type: text("type").default("text"),
  timestamp: timestamp("timestamp"),
  isFromMe: boolean("isFromMe").default(false),
  isRead: boolean("isRead").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// User WhatsApp accounts relationship table
export const userWhatsappAccounts = pgTable("user_whatsapp_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").references((): any => users.id),
  accountId: integer("accountId").references((): any => whatsappAccounts.id),
  role: text("role").default("agent"),
  permissions: jsonb("permissions"),
  assignedAt: timestamp("assignedAt").defaultNow(),
});

// Chat assignments table
export const chatAssignments = pgTable("chat_assignments", {
  id: serial("id").primaryKey(),
  chatId: text("chatId").notNull().unique(),
  agentId: integer("agentId").references((): any => users.id),
  accountId: integer("accountId").references((): any => whatsappAccounts.id),
  status: text("status").default("active"),
  priority: text("priority").default("normal"),
  assignedAt: timestamp("assignedAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt"),
});

// Chat comments table
export const chatComments = pgTable("chat_comments", {
  id: serial("id").primaryKey(),
  chatId: text("chatId").notNull(),
  userId: integer("userId").references((): any => users.id),
  comment: text("comment").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Chat categories table
export const chatCategories = pgTable("chat_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#3B82F6"),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Relations
export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignee: one(users, {
    fields: [leads.assigneeId],
    references: [users.id],
    relationName: "assignedLeads"
  }),
  activities: many(activities),
  messages: many(messages),
  surveys: many(surveys),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
    relationName: "userActivities"
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id],
  }),
}));

export const surveysRelations = relations(surveys, ({ one }) => ({
  lead: one(leads, {
    fields: [surveys.leadId],
    references: [leads.id],
  }),
}));

export const messageTemplatesRelations = relations(messageTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [messageTemplates.createdBy],
    references: [users.id],
  }),
  campaigns: many(marketingCampaigns),
}));

export const marketingCampaignsRelations = relations(marketingCampaigns, ({ one }) => ({
  template: one(messageTemplates, {
    fields: [marketingCampaigns.templateId],
    references: [messageTemplates.id],
  }),
  creator: one(users, {
    fields: [marketingCampaigns.createdBy],
    references: [users.id],
  }),
}));

export const mediaGalleryRelations = relations(mediaGallery, ({ one }) => ({
  uploader: one(users, {
    fields: [mediaGallery.uploadedBy],
    references: [users.id],
  }),
}));

export const whatsappAccountsRelations = relations(whatsappAccounts, ({ one, many }) => ({
  users: many(userWhatsappAccounts),
  messages: many(whatsappMessages),
  assignments: many(chatAssignments),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [whatsappMessages.accountId],
    references: [whatsappAccounts.id],
  }),
}));

export const aiConfigRelations = relations(aiConfig, ({ one }) => ({
  user: one(users, {
    fields: [aiConfig.userId],
    references: [users.id],
  }),
}));

export const timeZoneConfigRelations = relations(timeZoneConfig, ({ one }) => ({
  user: one(users, {
    fields: [timeZoneConfig.userId],
    references: [users.id],
  }),
}));

export const userWhatsappAccountsRelations = relations(userWhatsappAccounts, ({ one }) => ({
  user: one(users, {
    fields: [userWhatsappAccounts.userId],
    references: [users.id],
  }),
  account: one(whatsappAccounts, {
    fields: [userWhatsappAccounts.accountId],
    references: [whatsappAccounts.id],
  }),
}));

export const chatAssignmentsRelations = relations(chatAssignments, ({ one }) => ({
  agent: one(users, {
    fields: [chatAssignments.agentId],
    references: [users.id],
    relationName: "assignedChats"
  }),
  account: one(whatsappAccounts, {
    fields: [chatAssignments.accountId],
    references: [whatsappAccounts.id],
  }),
}));

export const chatCategoriesRelations = relations(chatCategories, ({ one }) => ({
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  supervisor: one(users, {
    fields: [users.supervisorId],
    references: [users.id],
    relationName: "supervisorRelation"
  }),
  assignedLeads: many(leads),
  activities: many(activities, { relationName: "userActivities" }),
  whatsappAccounts: many(userWhatsappAccounts),
  chatAssignments: many(chatAssignments, { relationName: "assignedChats" })
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, sentAt: true });
export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, sentAt: true, completedAt: true });
export const insertDashboardStatsSchema = createInsertSchema(dashboardStats).omit({ id: true, updatedAt: true });
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({ id: true, createdAt: true, updatedAt: true, stats: true });
export const insertMediaGallerySchema = createInsertSchema(mediaGallery).omit({ id: true, uploadedAt: true, lastUsedAt: true, useCount: true });
export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccounts).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertUserWhatsappAccountSchema = createInsertSchema(userWhatsappAccounts).omit({ id: true, assignedAt: true });
export const insertChatAssignmentSchema = createInsertSchema(chatAssignments).omit({ id: true, assignedAt: true, lastActivityAt: true });
export const insertChatCommentSchema = createInsertSchema(chatComments).omit({ id: true, createdAt: true });
export const insertChatCategorySchema = createInsertSchema(chatCategories).omit({ id: true, createdAt: true });
export const insertAiConfigSchema = createInsertSchema(aiConfig).omit({ id: true, updatedAt: true });
export const insertTimeZoneConfigSchema = createInsertSchema(timeZoneConfig).omit({ id: true, updatedAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });

// Insert types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type InsertDashboardStats = z.infer<typeof insertDashboardStatsSchema>;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;
export type InsertMediaGallery = z.infer<typeof insertMediaGallerySchema>;
export type InsertWhatsappAccount = z.infer<typeof insertWhatsappAccountSchema>;
export type InsertUserWhatsappAccount = z.infer<typeof insertUserWhatsappAccountSchema>;
export type InsertChatAssignment = z.infer<typeof insertChatAssignmentSchema>;
export type InsertChatComment = z.infer<typeof insertChatCommentSchema>;
export type InsertChatCategory = z.infer<typeof insertChatCategorySchema>;
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type InsertTimeZoneConfig = z.infer<typeof insertTimeZoneConfigSchema>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

// Select types
export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type DashboardStats = typeof dashboardStats.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;
export type MediaGallery = typeof mediaGallery.$inferSelect;
export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type UserWhatsappAccount = typeof userWhatsappAccounts.$inferSelect;
export type ChatAssignment = typeof chatAssignments.$inferSelect;
export type ChatComment = typeof chatComments.$inferSelect;
export type ChatCategory = typeof chatCategories.$inferSelect;
export type AiConfig = typeof aiConfig.$inferSelect;
export type TimeZoneConfig = typeof timeZoneConfig.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;