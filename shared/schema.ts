import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user table - con roles mejorados y campos adicionales
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("fullName"),
  email: text("email"),
  // Roles: admin, agent, supervisor
  // Roles: super_admin, admin, supervisor, agent
  role: text("role").default("agent"),
  // Estado: active, inactive, suspended
  status: text("status").default("active"),
  avatar: text("avatar"),
  // Departamento o área del usuario (ventas, soporte, marketing, etc.)
  department: text("department"),
  // El ID del supervisor o gerente de este usuario
  supervisorId: integer("supervisorId").references(() => users.id),
  // Ajustes personalizados para este usuario (tema, notificaciones, etc.)
  settings: jsonb("settings"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedat"), // Nota: en PostgreSQL los nombres se convierten a minúsculas
});

// WhatsApp Accounts - para manejar múltiples cuentas
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  // Información del propietario o usuario principal
  ownerName: text("ownerName"),
  ownerPhone: text("ownerPhone"),
  // JSON con datos de configuración y estado
  sessionData: jsonb("sessionData"),
  // Estado de la conexión: active, inactive, pending_auth
  status: text("status").default("inactive"),
  // Usuario asignado como administrador de esta cuenta
  adminId: integer("adminId").references(() => users.id),
  createdAt: timestamp("createdAt").defaultNow(),
  lastActiveAt: timestamp("lastActiveAt"),
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

// Tickets automáticos del sistema
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  // ID único del chat de WhatsApp 
  chatId: text("chatId").notNull(),
  // Cuenta de WhatsApp asociada
  accountId: integer("accountId").notNull().references(() => whatsappAccounts.id),
  // Agente asignado
  assignedToId: integer("assignedToId").references(() => users.id),
  // Información del cliente
  customerName: text("customerName"),
  customerPhone: text("customerPhone"),
  // Estados de ticket: nuevo, interesado, no_leido, pendiente_demo, completado, no_interesado
  status: text("status").default("nuevo"),
  // Prioridad: baja, media, alta, urgente
  priority: text("priority").default("media"),
  // Último mensaje del cliente
  lastMessage: text("lastMessage"),
  // Métricas del ticket
  totalMessages: integer("totalMessages").default(0),
  answeredMessages: integer("answeredMessages").default(0),
  unreadMessages: integer("unreadMessages").default(0),
  // Timestamps importantes
  createdAt: timestamp("createdAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow(),
  closedAt: timestamp("closedAt"),
  // Notas internas
  notes: text("notes"),
  // Etiquetas del ticket
  tags: text("tags").array(),
});

// Métricas de agentes por rendimiento
export const agentMetrics = pgTable("agent_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  // Métricas de mensajes
  totalMessagesSent: integer("totalMessagesSent").default(0),
  totalMessagesReceived: integer("totalMessagesReceived").default(0),
  averageResponseTime: integer("averageResponseTime").default(0), // en minutos
  // Métricas de tickets
  activeTickets: integer("activeTickets").default(0),
  completedTickets: integer("completedTickets").default(0),
  ticketsSolvedToday: integer("ticketsSolvedToday").default(0),
  // Métricas de conversión
  conversionsThisMonth: integer("conversionsThisMonth").default(0),
  totalConversions: integer("totalConversions").default(0),
  // Rating promedio (1-5 estrellas)
  averageRating: doublePrecision("averageRating").default(0),
  // Fecha de última actualización
  lastUpdated: timestamp("lastUpdated").defaultNow(),
});

// Actividad de mensajes para tracking detallado
export const messageActivity = pgTable("message_activity", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticketId").notNull().references(() => tickets.id),
  userId: integer("userId").references(() => users.id),
  chatId: text("chatId").notNull(),
  messageContent: text("messageContent"),
  messageType: text("messageType").default("text"), // text, image, audio, video, document
  direction: text("direction").notNull(), // incoming, outgoing
  isRead: boolean("isRead").default(false),
  sentAt: timestamp("sentAt").defaultNow(),
  readAt: timestamp("readAt"),
});

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

// Relaciones para tickets
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  account: one(whatsappAccounts, {
    fields: [tickets.accountId],
    references: [whatsappAccounts.id]
  }),
  assignedTo: one(users, {
    fields: [tickets.assignedToId],
    references: [users.id]
  }),
  messageActivity: many(messageActivity)
}));

// Relaciones para métricas de agentes
export const agentMetricsRelations = relations(agentMetrics, ({ one }) => ({
  user: one(users, {
    fields: [agentMetrics.userId],
    references: [users.id]
  })
}));

// Relaciones para actividad de mensajes
export const messageActivityRelations = relations(messageActivity, ({ one }) => ({
  ticket: one(tickets, {
    fields: [messageActivity.ticketId],
    references: [tickets.id]
  }),
  user: one(users, {
    fields: [messageActivity.userId],
    references: [users.id]
  })
}));

// Tipos para las nuevas tablas
export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = typeof tickets.$inferInsert;
export type AgentMetrics = typeof agentMetrics.$inferSelect;
export type InsertAgentMetrics = typeof agentMetrics.$inferInsert;
export type MessageActivity = typeof messageActivity.$inferSelect;
export type InsertMessageActivity = typeof messageActivity.$inferInsert;

// Esquemas de inserción para las nuevas tablas
export const insertTicketSchema = createInsertSchema(tickets).omit({ id: true, createdAt: true });
export const insertAgentMetricsSchema = createInsertSchema(agentMetrics).omit({ id: true, lastUpdated: true });
export const insertMessageActivitySchema = createInsertSchema(messageActivity).omit({ id: true, sentAt: true });

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

// Configuración de AI para respuestas automáticas
export const aiConfig = pgTable("ai_config", {
  id: serial("id").primaryKey(),
  autoResponse: boolean("auto_response").default(false),
  defaultModel: text("default_model").default("gemini"), // 'gemini', 'openai'
  confidenceThreshold: doublePrecision("confidence_threshold").default(0.75),
  geminiApiKey: text("gemini_api_key"),
  openaiApiKey: text("openai_api_key"),
  additionalPrompt: text("additional_prompt"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Configuración de zona horaria para mensajes
export const timeZoneConfig = pgTable("time_zone_config", {
  id: serial("id").primaryKey(),
  timeZone: text("time_zone").default("UTC"),
  offset: integer("offset").default(0), // Offset en horas
  source: text("source").default("manual"), // 'manual', 'auto', 'geolocation'
  location: jsonb("location"), // {latitude, longitude} si se detectó por geolocalización
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Mensajes de WhatsApp extendidos para microservicios
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => whatsappAccounts.id),
  messageId: text("message_id").notNull(), // ID original del mensaje de WhatsApp
  chatId: text("chat_id").notNull(), // ID del chat (número@c.us o grupo@g.us)
  body: text("body"), // Contenido del mensaje
  from: text("from"), // Remitente
  to: text("to"), // Destinatario
  fromMe: boolean("from_me").default(false), // Si fue enviado por nosotros
  timestamp: timestamp("timestamp").defaultNow(), // Timestamp del mensaje
  hasMedia: boolean("has_media").default(false), // Si tiene contenido multimedia
  mediaType: text("media_type"), // Tipo de contenido multimedia
  mediaUrl: text("media_url"), // URL del contenido multimedia
  caption: text("caption"), // Leyenda del contenido multimedia
  isForwarded: boolean("is_forwarded").default(false), // Si es un mensaje reenviado
  isStatus: boolean("is_status").default(false), // Si es un mensaje de estado
  isStarred: boolean("is_starred").default(false), // Si está destacado
  containsEmoji: boolean("contains_emoji").default(false), // Si contiene emojis
  timeZoneInfo: jsonb("time_zone_info"), // Información de zona horaria
  processingStatus: text("processing_status").default("pending"), // pending, processed, failed
  processorResult: jsonb("processor_result"), // Resultado del procesador de mensajes
  leadId: integer("lead_id").references(() => leads.id), // ID del lead si está asociado
  createdAt: timestamp("created_at").defaultNow(),
});

// Relaciones para galería de medios
export const mediaGalleryRelations = relations(mediaGallery, ({ one }) => ({
  uploader: one(users, {
    fields: [mediaGallery.uploadedBy],
    references: [users.id]
  })
}));

// Usuario-Cuenta WhatsApp para asignar agentes a diferentes cuentas
export const userWhatsappAccounts = pgTable("user_whatsapp_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  accountId: integer("accountId").notNull().references(() => whatsappAccounts.id),
  // Permisos: read_only, respond, full_access
  permissions: text("permissions").default("respond"),
  // Categorías o etiquetas de chats que este usuario puede manejar
  assignedCategories: text("assignedCategories").array(),
  assignedAt: timestamp("assignedAt").defaultNow(),
  assignedBy: integer("assignedBy").references(() => users.id),
});

// Chat-Agente para asignación de conversaciones a agentes específicos
export const chatAssignments = pgTable("chat_assignments", {
  id: serial("id").primaryKey(),
  // Chat ID en formato de WhatsApp (número@c.us)
  chatId: text("chatId").notNull(),
  // Conexión a la cuenta de WhatsApp
  accountId: integer("accountId").notNull().references(() => whatsappAccounts.id),
  // Usuario al que se asigna el chat
  assignedToId: integer("assignedToId").notNull().references(() => users.id),
  // Usuario que hizo la asignación
  assignedById: integer("assignedById").references(() => users.id),
  // Categoría o etiqueta del chat
  category: text("category"),
  // Estado: active, closed, transferred
  status: text("status").default("active"),
  // Notas o motivo de la asignación
  notes: text("notes"),
  assignedAt: timestamp("assignedAt").defaultNow(),
  lastActivityAt: timestamp("lastActivityAt"),
});

// Comentarios internos de chat
export const chatComments = pgTable("chat_comments", {
  id: serial("id").primaryKey(),
  chatId: text("chatId").notNull(),
  userId: integer("userId").notNull().references(() => users.id),
  text: text("text").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isInternal: boolean("isInternal").default(true),
});

// Categorización automática de chats
export const chatCategories = pgTable("chat_categories", {
  id: serial("id").primaryKey(),
  chatId: text("chatId").notNull(),
  accountId: integer("accountId").notNull().references(() => whatsappAccounts.id),
  category: text("category").notNull(), // sales, support, information, consultation
  confidence: doublePrecision("confidence").default(0),
  aiModel: text("aiModel").default("gemini"),
  lastAnalyzedAt: timestamp("lastAnalyzedAt").defaultNow(),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Tabla de notificaciones en tiempo real
export const realTimeNotifications = pgTable("real_time_notifications", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // new_message, new_assignment, chat_categorized, account_status
  title: text("title").notNull(),
  message: text("message").notNull(),
  chatId: text("chatId"),
  accountId: integer("accountId").references(() => whatsappAccounts.id),
  agentId: integer("agentId").references(() => users.id),
  category: text("category"),
  priority: text("priority").default("medium"), // low, medium, high
  isRead: boolean("isRead").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
});

// Configuración de respuestas automáticas
export const autoResponseConfig = pgTable("auto_response_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(false),
  provider: text("provider").default("gemini"), // gemini, openai, smartbots
  welcomeMessage: text("welcome_message"),
  businessHours: jsonb("business_hours"),
  maxResponsesPerDay: integer("max_responses_per_day").default(50),
  responseDelay: integer("response_delay").default(2), // segundos
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// Categorías predefinidas para organizar chats (se eliminó la tabla duplicada)

// Relaciones para cuentas de WhatsApp
export const whatsappAccountsRelations = relations(whatsappAccounts, ({ one, many }) => ({
  admin: one(users, {
    fields: [whatsappAccounts.adminId],
    references: [users.id]
  }),
  assignedUsers: many(userWhatsappAccounts),
  chatAssignments: many(chatAssignments),
  messages: many(whatsappMessages)
}));

// Relaciones para mensajes de WhatsApp
export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [whatsappMessages.accountId],
    references: [whatsappAccounts.id]
  }),
  lead: one(leads, {
    fields: [whatsappMessages.leadId],
    references: [leads.id]
  })
}));

// Relaciones para configuración de AI
export const aiConfigRelations = relations(aiConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [aiConfig.updatedBy],
    references: [users.id]
  })
}));

// Relaciones para configuración de zona horaria
export const timeZoneConfigRelations = relations(timeZoneConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [timeZoneConfig.updatedBy],
    references: [users.id]
  })
}));

// Relaciones para usuario-cuenta
export const userWhatsappAccountsRelations = relations(userWhatsappAccounts, ({ one }) => ({
  user: one(users, {
    fields: [userWhatsappAccounts.userId],
    references: [users.id]
  }),
  account: one(whatsappAccounts, {
    fields: [userWhatsappAccounts.accountId],
    references: [whatsappAccounts.id]
  }),
  assignedBy: one(users, {
    fields: [userWhatsappAccounts.assignedBy],
    references: [users.id]
  })
}));

// Relaciones para asignaciones de chat
export const chatAssignmentsRelations = relations(chatAssignments, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [chatAssignments.accountId],
    references: [whatsappAccounts.id]
  }),
  assignedTo: one(users, {
    fields: [chatAssignments.assignedToId],
    references: [users.id]
  }),
  assignedBy: one(users, {
    fields: [chatAssignments.assignedById],
    references: [users.id]
  })
}));

// Chat categories relations removed due to table restructuring

// Definir relaciones de usuarios
export const usersRelations = relations(users, ({ one, many }) => ({
  supervisor: one(users, {
    fields: [users.supervisorId],
    references: [users.id]
  }),
  subordinates: many(users, {
    relationName: "supervisorRelation"
  }),
  assignedLeads: many(leads),
  activities: many(activities, { relationName: "userActivities" }),
  whatsappAccounts: many(userWhatsappAccounts),
  chatAssignments: many(chatAssignments, { relationName: "assignedChats" })
}));

export const insertMediaGallerySchema = createInsertSchema(mediaGallery).omit({ id: true, uploadedAt: true, lastUsedAt: true, useCount: true });
export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccounts).omit({ id: true, createdAt: true, lastActiveAt: true });
export const insertUserWhatsappAccountSchema = createInsertSchema(userWhatsappAccounts).omit({ id: true, assignedAt: true });
export const insertChatAssignmentSchema = createInsertSchema(chatAssignments).omit({ id: true, assignedAt: true, lastActivityAt: true });
export const insertChatCategorySchema = createInsertSchema(chatCategories).omit({ id: true, createdAt: true });
export const insertAiConfigSchema = createInsertSchema(aiConfig).omit({ id: true, updatedAt: true });
export const insertTimeZoneConfigSchema = createInsertSchema(timeZoneConfig).omit({ id: true, updatedAt: true });
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });

export type InsertMediaGallery = z.infer<typeof insertMediaGallerySchema>;
export type InsertWhatsappAccount = z.infer<typeof insertWhatsappAccountSchema>;
export type InsertUserWhatsappAccount = z.infer<typeof insertUserWhatsappAccountSchema>;
export type InsertChatAssignment = z.infer<typeof insertChatAssignmentSchema>;
export type InsertChatCategory = z.infer<typeof insertChatCategorySchema>;
export type InsertAiConfig = z.infer<typeof insertAiConfigSchema>;
export type InsertTimeZoneConfig = z.infer<typeof insertTimeZoneConfigSchema>;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

export type MediaGallery = typeof mediaGallery.$inferSelect;
export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type UserWhatsappAccount = typeof userWhatsappAccounts.$inferSelect;
export type ChatAssignment = typeof chatAssignments.$inferSelect;
export type ChatCategory = typeof chatCategories.$inferSelect;
export type AiConfig = typeof aiConfig.$inferSelect;
export type TimeZoneConfig = typeof timeZoneConfig.$inferSelect;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
