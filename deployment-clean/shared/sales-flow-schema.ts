import { pgTable, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Sales Flow Stages
export const salesFlowStages = pgTable("sales_flow_stages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(), // "Prospecting", "Qualification", "Proposal", etc.
  description: text("description"),
  order: integer("order").notNull(),
  color: text("color").default("#3B82F6"),
  icon: text("icon").default("circle"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// Flow Nodes (each step in the conversation flow)
export const flowNodes = pgTable("flow_nodes", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // "trigger", "condition", "action", "response"
  position: jsonb("position").$type<{x: number, y: number}>(),
  config: jsonb("config").$type<{
    triggers?: string[];
    conditions?: any[];
    responses?: string[];
    aiPrompt?: string;
    nextNodes?: number[];
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

// Flow Connections (edges between nodes)
export const flowConnections = pgTable("flow_connections", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sourceNodeId: integer("source_node_id").references(() => flowNodes.id),
  targetNodeId: integer("target_node_id").references(() => flowNodes.id),
  condition: text("condition"), // "yes", "no", "timeout", etc.
  label: text("label"),
  style: jsonb("style").$type<{
    stroke?: string;
    strokeWidth?: number;
    animated?: boolean;
  }>(),
  createdAt: timestamp("created_at").defaultNow()
});

// Conversation Flow Sessions (track where each chat is in the flow)
export const conversationFlowSessions = pgTable("conversation_flow_sessions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  chatId: text("chat_id").notNull(),
  accountId: integer("account_id").notNull(),
  currentNodeId: integer("current_node_id").references(() => flowNodes.id),
  currentStageId: integer("current_stage_id").references(() => salesFlowStages.id),
  sessionData: jsonb("session_data").$type<{
    customerName?: string;
    customerEmail?: string;
    customerPhone?: string;
    interests?: string[];
    budget?: number;
    timeline?: string;
    leadScore?: number;
    customFields?: Record<string, any>;
  }>(),
  isActive: boolean("is_active").default(true),
  startedAt: timestamp("started_at").defaultNow(),
  lastActivityAt: timestamp("last_activity_at").defaultNow(),
  completedAt: timestamp("completed_at")
});

// Flow Execution Log (track conversation progression)
export const flowExecutionLog = pgTable("flow_execution_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  sessionId: integer("session_id").references(() => conversationFlowSessions.id),
  nodeId: integer("node_id").references(() => flowNodes.id),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  action: text("action").notNull(), // "entered", "completed", "skipped"
  messageText: text("message_text"),
  aiResponse: text("ai_response"),
  executionTime: integer("execution_time"), // ms
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  executedAt: timestamp("executed_at").defaultNow()
});

// Sales Performance Metrics
export const salesMetrics = pgTable("sales_metrics", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  accountId: integer("account_id").notNull(),
  stageId: integer("stage_id").references(() => salesFlowStages.id),
  date: timestamp("date").defaultNow(),
  conversationsStarted: integer("conversations_started").default(0),
  conversationsCompleted: integer("conversations_completed").default(0),
  conversionRate: integer("conversion_rate").default(0), // percentage * 100
  averageTime: integer("average_time").default(0), // seconds
  revenue: integer("revenue").default(0), // cents
  createdAt: timestamp("created_at").defaultNow()
});

// Schema exports for frontend use
export const insertSalesFlowStageSchema = createInsertSchema(salesFlowStages);
export const insertFlowNodeSchema = createInsertSchema(flowNodes);
export const insertFlowConnectionSchema = createInsertSchema(flowConnections);
export const insertConversationFlowSessionSchema = createInsertSchema(conversationFlowSessions);
export const insertFlowExecutionLogSchema = createInsertSchema(flowExecutionLog);
export const insertSalesMetricsSchema = createInsertSchema(salesMetrics);

export type SalesFlowStage = typeof salesFlowStages.$inferSelect;
export type FlowNode = typeof flowNodes.$inferSelect;
export type FlowConnection = typeof flowConnections.$inferSelect;
export type ConversationFlowSession = typeof conversationFlowSessions.$inferSelect;
export type FlowExecutionLog = typeof flowExecutionLog.$inferSelect;
export type SalesMetrics = typeof salesMetrics.$inferSelect;

export type InsertSalesFlowStage = z.infer<typeof insertSalesFlowStageSchema>;
export type InsertFlowNode = z.infer<typeof insertFlowNodeSchema>;
export type InsertFlowConnection = z.infer<typeof insertFlowConnectionSchema>;
export type InsertConversationFlowSession = z.infer<typeof insertConversationFlowSessionSchema>;
export type InsertFlowExecutionLog = z.infer<typeof insertFlowExecutionLogSchema>;
export type InsertSalesMetrics = z.infer<typeof insertSalesMetricsSchema>;