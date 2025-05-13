import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user table - extending from what's already present
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  role: text("role").default("user"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Lead model - represents potential customers
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  source: text("source"), // where the lead came from
  status: text("status").default("new"), // new, contacted, meeting, closed-won, closed-lost
  score: integer("score"), // AI-generated lead score from 0-100
  notes: text("notes"),
  assignedTo: integer("assigned_to").references(() => users.id),
  lastContact: timestamp("last_contact"),
  nextFollowUp: timestamp("next_follow_up"),
  createdAt: timestamp("created_at").defaultNow(),
  enrichmentData: json("enrichment_data"), // AI-enriched data about the lead
  matchPercentage: integer("match_percentage"), // AI-determined match to ideal customer
  // Campos para integración con plataformas de mensajería
  whatsappPhone: text("whatsapp_phone"), // Número de WhatsApp normalizado
  telegramChatId: text("telegram_chat_id"), // ID de chat de Telegram
});

// Activities model - represents meetings, calls, emails, tasks
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(), // meeting, call, email, task, etc.
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  completed: boolean("completed").default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  aiGenerated: boolean("ai_generated").default(false),
  aiSummary: text("ai_summary"),
});

// Messages model - represents conversations with leads
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => leads.id),
  userId: integer("user_id").references(() => users.id),
  direction: text("direction").notNull(), // incoming, outgoing
  channel: text("channel").notNull(), // email, whatsapp, chat, system
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  read: boolean("read").default(false),
  aiGenerated: boolean("ai_generated").default(false),
  aiAnalysis: json("ai_analysis"), // sentiment, intent, etc.
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
  totalLeads: integer("total_leads").notNull(),
  conversionRate: integer("conversion_rate").notNull(), // stored as percentage * 100
  activeConversations: integer("active_conversations").notNull(),
  todayMeetings: integer("today_meetings").notNull(),
  leadsByStatus: json("leads_by_status").notNull(), // object with counts by status
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for each model
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertLeadSchema = createInsertSchema(leads).omit({ id: true, createdAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, sentAt: true });
export const insertSurveySchema = createInsertSchema(surveys).omit({ id: true, sentAt: true, completedAt: true });
export const insertDashboardStatsSchema = createInsertSchema(dashboardStats).omit({ id: true, updatedAt: true });

// Types for insert and select operations
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;
export type InsertDashboardStats = z.infer<typeof insertDashboardStatsSchema>;

export type User = typeof users.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Survey = typeof surveys.$inferSelect;
export type DashboardStats = typeof dashboardStats.$inferSelect;
