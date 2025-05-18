import { pgTable, serial, text, timestamp, integer, boolean, json } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Tabla de usuarios
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  role: text('role').default('user').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabla de leads (clientes potenciales)
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  status: text('status').default('nuevo').notNull(),
  source: text('source'),
  assignedTo: integer('assigned_to').references(() => users.id),
  notes: text('notes'),
  lastContact: timestamp('last_contact'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabla de actividades
export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: text('type').notNull(), // llamada, correo, reunión, etc.
  notes: text('notes'),
  scheduledFor: timestamp('scheduled_for'),
  completed: boolean('completed').default(false),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Tabla de mensajes
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id).notNull(),
  content: text('content').notNull(),
  direction: text('direction').notNull(), // entrante o saliente
  channel: text('channel').notNull(), // whatsapp, email, telegram, etc.
  read: boolean('read').default(false),
  metadata: json('metadata'),
  sentAt: timestamp('sent_at').defaultNow().notNull()
});

// Tabla de encuestas
export const surveys = pgTable('surveys', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').references(() => leads.id).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  responses: json('responses'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at')
});

// Tabla de estadísticas del dashboard
export const dashboardStats = pgTable('dashboard_stats', {
  id: serial('id').primaryKey(),
  totalLeads: integer('total_leads').default(0),
  newLeadsThisMonth: integer('new_leads_this_month').default(0),
  convertedLeadsThisMonth: integer('converted_leads_this_month').default(0),
  totalMessages: integer('total_messages').default(0),
  responseRate: integer('response_rate').default(0),
  avgResponseTime: integer('avg_response_time').default(0),
  leadsPerSource: json('leads_per_source'),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Tabla de configuraciones de Gemini
export const geminiSettings = pgTable('gemini_settings', {
  id: serial('id').primaryKey(),
  model: text('model').default('gemini-pro').notNull(),
  professionLevel: text('profession_level').default('professional').notNull(),
  temperature: integer('temperature').default(70),
  maxTokens: integer('max_tokens').default(500),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Esquemas de inserción
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, sentAt: true });
export const insertDashboardStatsSchema = createInsertSchema(dashboardStats).omit({ id: true, updatedAt: true });
export const insertGeminiSettingsSchema = createInsertSchema(geminiSettings).omit({ id: true, updatedAt: true });

// Tipos basados en los esquemas
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;

export type DashboardStats = typeof dashboardStats.$inferSelect;
export type InsertDashboardStats = z.infer<typeof insertDashboardStatsSchema>;

export type GeminiSettings = typeof geminiSettings.$inferSelect;
export type InsertGeminiSettings = z.infer<typeof insertGeminiSettingsSchema>;