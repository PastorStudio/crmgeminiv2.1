import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user table - extending from what's already present
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("fullName"),
  email: text("email"),
  role: text("role").default("user"),
  avatar: text("avatar"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Lead model - represents potential customers
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  source: text("source"), // where the lead came from
  status: text("status").default("new"), // new, contacted, meeting, closed-won, closed-lost
  notes: text("notes"),
  assigneeId: integer("assigneeId").references(() => users.id),
  budget: doublePrecision("budget"),
  priority: text("priority"),
  tags: text("tags").array(), // tags applied to the lead
  createdAt: timestamp("createdAt").defaultNow(),
});

// Activities model - represents meetings, calls, emails, tasks
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").references(() => leads.id),
  userId: integer("userId").references(() => users.id),
  type: text("type").notNull(), // meeting, call, email, task, etc.
  scheduled: timestamp("scheduled").notNull(),
  notes: text("notes"),
  completed: boolean("completed").default(false),
  priority: text("priority"),
  reminder: timestamp("reminder"),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Messages model - represents conversations with leads
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  leadId: integer("leadId").references(() => leads.id),
  content: text("content").notNull(),
  direction: text("direction").notNull(), // incoming, outgoing
  channel: text("channel").notNull(), // email, whatsapp, chat, system
  read: boolean("read").default(false),
  sentAt: timestamp("sentAt").defaultNow(),
});

// Surveys model - represents feedback forms sent to leads/customers
export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  title: text("title").notNull(),
  questions: json("questions").notNull(), // array of question objects
  responses: json("responses"), // array of response objects
  sentAt: timestamp("sent_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  aiAnalysis: json("ai_analysis"), // results of AI analyzing the responses
  createdBy: integer("created_by").references(() => users.id),
});

// Dashboard KPIs model - for dashboard statistics
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

// Plantillas de mensajes - para reutilizar contenido en campañas
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  category: text("category"), // ventas, soporte, bienvenida, etc.
  tags: text("tags").array(),
  variables: jsonb("variables"), // JSON con variables disponibles y ejemplos
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  createdBy: integer("createdBy").references(() => users.id),
  isActive: boolean("isActive").default(true),
});

// Campañas de marketing - para envío masivo de mensajes
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  templateId: integer("templateId").references(() => messageTemplates.id),
  status: text("status").default("draft"), // draft, scheduled, running, paused, completed
  scheduledStart: timestamp("scheduledStart"),
  scheduledEnd: timestamp("scheduledEnd"),
  recipientList: jsonb("recipientList"), // JSON con información de destinatarios o criterios
  importedContacts: jsonb("importedContacts"), // JSON con contactos importados desde Excel
  sendingConfig: jsonb("sendingConfig"), // JSON con configuración de envío (velocidad, pausas, etc.)
  stats: jsonb("stats").default('{"total": 0, "sent": 0, "delivered": 0, "read": 0, "responses": 0, "failed": 0}'),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
  createdBy: integer("createdBy").references(() => users.id),
});

// Insert schemas for each model
// Definir relaciones
export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads),
  activities: many(activities, { relationName: "userActivities" })
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignee: one(users, {
    fields: [leads.assigneeId],
    references: [users.id]
  }),
  activities: many(activities),
  messages: many(messages),
  surveys: many(surveys)
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

export const surveysRelations = relations(surveys, ({ one }) => ({
  lead: one(leads, {
    fields: [surveys.leadId],
    references: [leads.id]
  }),
  createdBy: one(users, {
    fields: [surveys.createdBy],
    references: [users.id]
  })
}));

// Relaciones para plantillas de mensajes
export const messageTemplatesRelations = relations(messageTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [messageTemplates.createdBy],
    references: [users.id]
  }),
  campaigns: many(marketingCampaigns)
}));

// Relaciones para campañas de marketing
export const marketingCampaignsRelations = relations(marketingCampaigns, ({ one }) => ({
  template: one(messageTemplates, {
    fields: [marketingCampaigns.templateId],
    references: [messageTemplates.id]
  }),
  creator: one(users, {
    fields: [marketingCampaigns.createdBy],
    references: [users.id]
  })
}));

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, sentAt: true });
export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, sentAt: true, completedAt: true });
export const insertDashboardStatsSchema = createInsertSchema(dashboardStats).omit({ id: true, updatedAt: true });
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMarketingCampaignSchema = createInsertSchema(marketingCampaigns).omit({ id: true, createdAt: true, updatedAt: true, stats: true });

// Types for insert and select operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type InsertDashboardStats = z.infer<typeof insertDashboardStatsSchema>;
export type InsertMessageTemplate = z.infer<typeof insertMessageTemplateSchema>;
export type InsertMarketingCampaign = z.infer<typeof insertMarketingCampaignSchema>;

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type DashboardStats = typeof dashboardStats.$inferSelect;
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type MarketingCampaign = typeof marketingCampaigns.$inferSelect;

// Tabla para galería de archivos
export const mediaGallery = pgTable("media_gallery", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  type: text("type").notNull(), // image, document, audio, video
  tags: text("tags").array(),
  title: text("title"),
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
  useCount: integer("use_count").default(0),
});

// Relaciones para galería de medios
export const mediaGalleryRelations = relations(mediaGallery, ({ one }) => ({
  uploader: one(users, {
    fields: [mediaGallery.uploadedBy],
    references: [users.id]
  })
}));

export const insertMediaGallerySchema = createInsertSchema(mediaGallery).omit({ id: true, uploadedAt: true, lastUsedAt: true, useCount: true });
export type InsertMediaGallery = z.infer<typeof insertMediaGallerySchema>;
export type MediaGallery = typeof mediaGallery.$inferSelect;
