import { relations, sql } from "drizzle-orm";
import { text, integer, pgTable, serial, varchar, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "supervisor", "agent", "viewer", "superadmin"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive", "pending"]);
export const leadStatusEnum = pgEnum("lead_status", ["nuevo", "contactado", "calificado", "negociacion", "ganado", "perdido"]);
export const activityTypeEnum = pgEnum("activity_type", ["call", "meeting", "email", "task", "note"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["nuevo", "en_progreso", "resuelto", "cancelado", "sin_asignar"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["baja", "media", "alta", "critica"]);
export const ticketCategoryEnum = pgEnum("ticket_category", ["soporte", "ventas", "facturacion", "tecnico", "consulta"]);

// Tablas
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 100 }),
  email: varchar("email", { length: 100 }),
  role: userRoleEnum("role").default("agent"),
  status: userStatusEnum("status").default("active"),
  avatar: varchar("avatar", { length: 255 }),
  department: varchar("department", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  lastLogin: timestamp("last_login"),
  preferences: text("preferences"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  agentLeads: many(leads),
  agentActivities: many(activities),
  assignedTickets: many(tickets),
  whatsappAccounts: many(userWhatsappAccounts),
}));

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }),
  phone: varchar("phone", { length: 20 }),
  company: varchar("company", { length: 100 }),
  position: varchar("position", { length: 100 }),
  status: leadStatusEnum("status").default("nuevo"),
  source: varchar("source", { length: 50 }),
  assignedTo: integer("assigned_to").references(() => users.id),
  tags: text("tags").array(),
  notes: text("notes"),
  interestLevel: integer("interest_level"), // 1-5
  budget: integer("budget"),
  timeline: varchar("timeline", { length: 50 }),
  lastContact: timestamp("last_contact"),
  nextContact: timestamp("next_contact"),
  chatId: varchar("chat_id", { length: 255 }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const leadsRelations = relations(leads, ({ one, many }) => ({
  assignedTo: one(users, {
    fields: [leads.assignedTo],
    references: [users.id],
  }),
  activities: many(activities),
  messages: many(messages),
  surveys: many(surveys),
  tickets: many(tickets),
}));

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  userId: integer("user_id").references(() => users.id),
  type: activityTypeEnum("type").notNull(),
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  outcome: text("outcome"),
  reminderTime: timestamp("reminder_time"),
  isAutomatic: boolean("is_automatic").default(false), // Para actividades generadas por IA
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, {
    fields: [activities.leadId],
    references: [leads.id],
  }),
  user: one(users, {
    fields: [activities.userId],
    references: [users.id],
  }),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  content: text("content").notNull(),
  fromLead: boolean("from_lead").default(false),
  read: boolean("read").default(false),
  readAt: timestamp("read_at"),
  attachments: text("attachments").array(),
  sentAt: timestamp("sent_at").defaultNow(),
  channel: varchar("channel", { length: 50 }).default("whatsapp"),
  messageId: varchar("message_id", { length: 255 }), // ID del mensaje en el canal (WhatsApp, email, etc.)
});

export const messagesRelations = relations(messages, ({ one }) => ({
  lead: one(leads, {
    fields: [messages.leadId],
    references: [leads.id],
  }),
}));

export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  title: varchar("title", { length: 100 }).notNull(),
  questions: text("questions").notNull(), // JSON con las preguntas
  responses: text("responses"), // JSON con las respuestas
  sentAt: timestamp("sent_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
});

export const surveysRelations = relations(surveys, ({ one }) => ({
  lead: one(leads, {
    fields: [surveys.leadId],
    references: [leads.id],
  }),
}));

export const dashboardStats = pgTable("dashboard_stats", {
  id: serial("id").primaryKey(),
  totalLeads: integer("total_leads").default(0),
  newLeadsThisMonth: integer("new_leads_this_month").default(0),
  activeDeals: integer("active_deals").default(0),
  closedDealsThisMonth: integer("closed_deals_this_month").default(0),
  totalRevenue: integer("total_revenue").default(0),
  revenueThisMonth: integer("revenue_this_month").default(0),
  leadsDistribution: text("leads_distribution"), // JSON con distribución por estado, fuente, etc.
  conversionRates: text("conversion_rates"), // JSON con tasas de conversión
  topPerformers: text("top_performers"), // JSON con mejores agentes
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Whatsapp Accounts
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  status: varchar("status", { length: 50 }).default("inactive"),
  sessionData: text("session_data"),
  settings: text("settings"), // JSON con configuraciones
  lastActive: timestamp("last_active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const whatsappAccountsRelations = relations(whatsappAccounts, ({ many }) => ({
  userAccounts: many(userWhatsappAccounts),
}));

// Asignaciones de cuentas de WhatsApp a usuarios
export const userWhatsappAccounts = pgTable("user_whatsapp_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => whatsappAccounts.id).notNull(),
  role: varchar("role", { length: 50 }).default("user"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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

// Asignaciones de chats a agentes
export const chatAssignments = pgTable("chat_assignments", {
  id: serial("id").primaryKey(),
  chatId: varchar("chat_id", { length: 255 }).notNull(),
  agentId: integer("agent_id").references(() => users.id).notNull(),
  accountId: integer("account_id").references(() => whatsappAccounts.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatAssignmentsRelations = relations(chatAssignments, ({ one }) => ({
  agent: one(users, {
    fields: [chatAssignments.agentId],
    references: [users.id],
  }),
  account: one(whatsappAccounts, {
    fields: [chatAssignments.accountId],
    references: [whatsappAccounts.id],
  }),
}));

// Plantillas de mensaje
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }),
  tags: text("tags").array(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messageTemplatesRelations = relations(messageTemplates, ({ one }) => ({
  createdBy: one(users, {
    fields: [messageTemplates.createdBy],
    references: [users.id],
  }),
}));

// Categorías de chat
export const chatCategories = pgTable("chat_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Agentes 
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).default("active"),
  department: varchar("department", { length: 100 }),
  supervisorId: integer("supervisor_id").references(() => users.id),
  activeSince: timestamp("active_since"),
  lastActive: timestamp("last_active"),
  skills: text("skills").array(),
  performance: text("performance"), // JSON con métricas de desempeño
  level: varchar("level", { length: 20 }),
  maxLeads: integer("max_leads").default(10),
  maxChats: integer("max_chats").default(5),
  workingHours: text("working_hours"), // JSON con horario
  avatar: varchar("avatar", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  hireDate: timestamp("hire_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentsRelations = relations(agents, ({ one }) => ({
  supervisor: one(users, {
    fields: [agents.supervisorId],
    references: [users.id],
  }),
}));

// Sistema de tickets para atención al cliente
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").default("nuevo"),
  priority: ticketPriorityEnum("priority").default("media"),
  category: ticketCategoryEnum("category").default("consulta"),
  leadId: integer("lead_id").references(() => leads.id),
  assignedTo: integer("assigned_to").references(() => users.id),
  chatId: varchar("chat_id", { length: 255 }),
  source: varchar("source", { length: 50 }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ticketsRelations = relations(tickets, ({ one }) => ({
  lead: one(leads, {
    fields: [tickets.leadId],
    references: [leads.id],
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedTo],
    references: [users.id],
  }),
}));

// Campañas de marketing
// Galería de medios
export const mediaGallery = pgTable("media_gallery", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }),
  mimeType: varchar("mime_type", { length: 100 }),
  size: integer("size"),
  path: varchar("path", { length: 255 }).notNull(),
  url: varchar("url", { length: 255 }),
  type: varchar("type", { length: 50 }), // image, video, document, audio, etc.
  tags: text("tags").array(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("draft"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  budget: integer("budget"),
  results: text("results"), // JSON con resultados
  templateId: integer("template_id").references(() => messageTemplates.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tipos con Zod
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;
export const insertLeadSchema = createInsertSchema(leads);
export const selectLeadSchema = createSelectSchema(leads);

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;
export const insertActivitySchema = createInsertSchema(activities);
export const selectActivitySchema = createSelectSchema(activities);

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = typeof surveys.$inferInsert;
export const insertSurveySchema = createInsertSchema(surveys);
export const selectSurveySchema = createSelectSchema(surveys);

export type DashboardStats = typeof dashboardStats.$inferSelect;
export type InsertDashboardStats = typeof dashboardStats.$inferInsert;
export const insertDashboardStatsSchema = createInsertSchema(dashboardStats);
export const selectDashboardStatsSchema = createSelectSchema(dashboardStats);

export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type InsertWhatsappAccount = typeof whatsappAccounts.$inferInsert;
export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccounts);
export const selectWhatsappAccountSchema = createSelectSchema(whatsappAccounts);

export type UserWhatsappAccount = typeof userWhatsappAccounts.$inferSelect;
export type InsertUserWhatsappAccount = typeof userWhatsappAccounts.$inferInsert;
export const insertUserWhatsappAccountSchema = createInsertSchema(userWhatsappAccounts);
export const selectUserWhatsappAccountSchema = createSelectSchema(userWhatsappAccounts);

export type ChatAssignment = typeof chatAssignments.$inferSelect;
export type InsertChatAssignment = typeof chatAssignments.$inferInsert;
export const insertChatAssignmentSchema = createInsertSchema(chatAssignments);
export const selectChatAssignmentSchema = createSelectSchema(chatAssignments);

export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;
export const insertMessageTemplateSchema = createInsertSchema(messageTemplates);
export const selectMessageTemplateSchema = createSelectSchema(messageTemplates);

export type ChatCategory = typeof chatCategories.$inferSelect;
export type InsertChatCategory = typeof chatCategories.$inferInsert;
export const insertChatCategorySchema = createInsertSchema(chatCategories);
export const selectChatCategorySchema = createSelectSchema(chatCategories);

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
export const insertAgentSchema = createInsertSchema(agents);
export const selectAgentSchema = createSelectSchema(agents);

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export const insertTicketSchema = createInsertSchema(tickets);
export const selectTicketSchema = createSelectSchema(tickets);

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;
export const insertCampaignSchema = createInsertSchema(campaigns);
export const selectCampaignSchema = createSelectSchema(campaigns);