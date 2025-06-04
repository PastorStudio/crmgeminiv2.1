import { pgTable, serial, text, timestamp, integer, boolean, varchar, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const whatsappAccounts = pgTable('whatsapp_accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').default('disconnected'),
  phoneNumber: text('phone_number'),
  qrCode: text('qr_code'),
  lastActivity: timestamp('last_activity').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => whatsappAccounts.id),
  chatId: text('chat_id').notNull(),
  messageId: text('message_id').notNull(),
  from: text('from').notNull(),
  body: text('body'),
  timestamp: timestamp('timestamp').defaultNow(),
  isFromMe: boolean('is_from_me').default(false),
  messageType: text('message_type').default('text')
});

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  source: text('source').default('whatsapp'),
  value: text('value'),
  whatsappAccountId: integer('whatsapp_account_id').references(() => whatsappAccounts.id),
  status: text('status').default('new'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  tags: text('tags').array().default([]),
  customFields: jsonb('custom_fields'),
  contactId: integer('contact_id'),
  assignedTo: integer('assigned_to'),
  lastContactDate: timestamp('last_contact_date'),
  nextFollowUp: timestamp('next_follow_up'),
  priority: text('priority').default('medium'),
  notes: text('notes'),
  conversionProbability: integer('conversion_probability').default(0),
  estimatedValue: text('estimated_value'),
  leadScore: integer('lead_score').default(0)
});

export const externalAgents = pgTable('external_agents', {
  id: text('id').primaryKey(),
  agentName: text('agent_name').notNull(),
  agentUrl: text('agent_url').notNull(),
  provider: text('provider').default('custom'),
  status: text('status').default('active'),
  lastUsed: timestamp('last_used').defaultNow(),
  responseCount: integer('response_count').default(0),
  averageResponseTime: integer('average_response_time').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  accountId: integer('account_id').references(() => whatsappAccounts.id),
  chatId: text('chat_id')
});

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  activityType: text('activity_type').notNull(),
  details: text('details'),
  timestamp: timestamp('timestamp').defaultNow(),
  category: text('category').default('general'),
  metadata: jsonb('metadata')
});

// Relations
export const whatsappAccountsRelations = relations(whatsappAccounts, ({ many }) => ({
  messages: many(messages),
  leads: many(leads),
  externalAgents: many(externalAgents)
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [messages.accountId],
    references: [whatsappAccounts.id]
  })
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  whatsappAccount: one(whatsappAccounts, {
    fields: [leads.whatsappAccountId],
    references: [whatsappAccounts.id]
  })
}));

export const externalAgentsRelations = relations(externalAgents, ({ one }) => ({
  account: one(whatsappAccounts, {
    fields: [externalAgents.accountId],
    references: [whatsappAccounts.id]
  })
}));

// Schemas for validation
export const insertWhatsappAccountSchema = createInsertSchema(whatsappAccounts);
export const selectWhatsappAccountSchema = createSelectSchema(whatsappAccounts);
export const insertMessageSchema = createInsertSchema(messages);
export const selectMessageSchema = createSelectSchema(messages);
export const insertLeadSchema = createInsertSchema(leads);
export const selectLeadSchema = createSelectSchema(leads);
export const insertExternalAgentSchema = createInsertSchema(externalAgents);
export const selectExternalAgentSchema = createSelectSchema(externalAgents);

export type WhatsappAccount = typeof whatsappAccounts.$inferSelect;
export type NewWhatsappAccount = typeof whatsappAccounts.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type ExternalAgent = typeof externalAgents.$inferSelect;
export type NewExternalAgent = typeof externalAgents.$inferInsert;