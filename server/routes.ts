import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertUserSchema, 
  insertLeadSchema, 
  insertActivitySchema, 
  insertMessageSchema, 
  insertSurveySchema,
  insertDashboardStatsSchema
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes prefix with /api
  
  // Health check endpoint
  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Users endpoints
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Leads endpoints
  app.get("/api/leads", async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string;
      const assignedTo = req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined;
      
      if (status) {
        const leads = await storage.getLeadsByStatus(status);
        return res.json(leads);
      } else if (assignedTo) {
        const leads = await storage.getLeadsByAssignee(assignedTo);
        return res.json(leads);
      } else {
        const leads = await storage.getAllLeads();
        return res.json(leads);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  app.get("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const lead = await storage.getLead(leadId);
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(lead);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch lead" });
    }
  });

  app.post("/api/leads", async (req: Request, res: Response) => {
    try {
      const leadData = insertLeadSchema.parse(req.body);
      const newLead = await storage.createLead(leadData);
      res.status(201).json(newLead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid lead data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create lead" });
    }
  });

  app.patch("/api/leads/:id", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const leadData = req.body;
      
      const updatedLead = await storage.updateLead(leadId, leadData);
      
      if (!updatedLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lead" });
    }
  });

  app.patch("/api/leads/:id/status", async (req: Request, res: Response) => {
    try {
      const leadId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedLead = await storage.updateLeadStatus(leadId, status);
      
      if (!updatedLead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      res.json(updatedLead);
    } catch (error) {
      res.status(500).json({ message: "Failed to update lead status" });
    }
  });

  // Activities endpoints
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const upcoming = req.query.upcoming === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      if (leadId) {
        const activities = await storage.getActivitiesByLead(leadId);
        return res.json(activities);
      } else if (userId && upcoming) {
        const activities = await storage.getUpcomingActivities(userId, limit);
        return res.json(activities);
      } else if (userId) {
        const activities = await storage.getActivitiesByUser(userId);
        return res.json(activities);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.get("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const activity = await storage.getActivity(activityId);
      
      if (!activity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(activity);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post("/api/activities", async (req: Request, res: Response) => {
    try {
      const activityData = insertActivitySchema.parse(req.body);
      const newActivity = await storage.createActivity(activityData);
      res.status(201).json(newActivity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create activity" });
    }
  });

  app.patch("/api/activities/:id", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const activityData = req.body;
      
      const updatedActivity = await storage.updateActivity(activityId, activityData);
      
      if (!updatedActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(updatedActivity);
    } catch (error) {
      res.status(500).json({ message: "Failed to update activity" });
    }
  });

  app.patch("/api/activities/:id/complete", async (req: Request, res: Response) => {
    try {
      const activityId = parseInt(req.params.id);
      const completedActivity = await storage.completeActivity(activityId);
      
      if (!completedActivity) {
        return res.status(404).json({ message: "Activity not found" });
      }
      
      res.json(completedActivity);
    } catch (error) {
      res.status(500).json({ message: "Failed to complete activity" });
    }
  });

  // Messages endpoints
  app.get("/api/messages", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      const recent = req.query.recent === "true";
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      if (leadId) {
        const messages = await storage.getMessagesByLead(leadId);
        return res.json(messages);
      } else if (recent) {
        const messages = await storage.getRecentMessages(limit);
        return res.json(messages);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/:id", async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch message" });
    }
  });

  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      const newMessage = await storage.createMessage(messageData);
      res.status(201).json(newMessage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id/read", async (req: Request, res: Response) => {
    try {
      const messageId = parseInt(req.params.id);
      const updatedMessage = await storage.markMessageAsRead(messageId);
      
      if (!updatedMessage) {
        return res.status(404).json({ message: "Message not found" });
      }
      
      res.json(updatedMessage);
    } catch (error) {
      res.status(500).json({ message: "Failed to mark message as read" });
    }
  });

  // Surveys endpoints
  app.get("/api/surveys", async (req: Request, res: Response) => {
    try {
      const leadId = req.query.leadId ? parseInt(req.query.leadId as string) : undefined;
      
      if (leadId) {
        const surveys = await storage.getSurveysByLead(leadId);
        return res.json(surveys);
      } else {
        return res.status(400).json({ message: "Missing required parameters" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch surveys" });
    }
  });

  app.get("/api/surveys/:id", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.id);
      const survey = await storage.getSurvey(surveyId);
      
      if (!survey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      
      res.json(survey);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch survey" });
    }
  });

  app.post("/api/surveys", async (req: Request, res: Response) => {
    try {
      const surveyData = insertSurveySchema.parse(req.body);
      const newSurvey = await storage.createSurvey(surveyData);
      res.status(201).json(newSurvey);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid survey data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create survey" });
    }
  });

  app.patch("/api/surveys/:id/responses", async (req: Request, res: Response) => {
    try {
      const surveyId = parseInt(req.params.id);
      const { responses } = req.body;
      
      if (!responses) {
        return res.status(400).json({ message: "Responses are required" });
      }
      
      const updatedSurvey = await storage.updateSurveyResponses(surveyId, responses);
      
      if (!updatedSurvey) {
        return res.status(404).json({ message: "Survey not found" });
      }
      
      res.json(updatedSurvey);
    } catch (error) {
      res.status(500).json({ message: "Failed to update survey responses" });
    }
  });

  // Dashboard stats endpoint
  app.get("/api/dashboard-stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      
      if (!stats) {
        return res.status(404).json({ message: "Dashboard stats not found" });
      }
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.patch("/api/dashboard-stats", async (req: Request, res: Response) => {
    try {
      const statsData = insertDashboardStatsSchema.parse(req.body);
      const updatedStats = await storage.updateDashboardStats(statsData);
      res.json(updatedStats);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stats data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update dashboard stats" });
    }
  });

  // Gemini AI endpoints - for integrating with Google's Gemini
  app.post("/api/gemini/analyze-lead", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ message: "Lead ID is required" });
      }
      
      const lead = await storage.getLead(parseInt(leadId));
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/gemini');
      
      try {
        // Call the Gemini API to analyze the lead
        const aiAnalysis = await geminiService.analyzeLead(lead);
        
        // Update the lead with AI analysis
        const updatedLead = await storage.updateLead(parseInt(leadId), {
          score: aiAnalysis.score,
          matchPercentage: aiAnalysis.matchPercentage,
          enrichmentData: aiAnalysis.enrichmentData
        });
        
        res.json(aiAnalysis);
      } catch (error: any) {
        // Check if error is related to missing API key
        if (error.message === 'GEMINI_API_KEY is not set') {
          // Fallback to sample data if API key is missing
          const aiAnalysis = {
            score: 65,
            matchPercentage: 78,
            enrichmentData: {
              insights: ["Lead appears to be from technology sector", "Decision maker at company"],
              recommendedActions: ["Schedule a demo", "Send product information"],
              nextSteps: "Follow up within 3 days",
              potentialBudget: "Medium",
              decisionTimeframe: "Next quarter"
            }
          };
          
          // Update the lead with the fallback analysis
          const updatedLead = await storage.updateLead(parseInt(leadId), {
            score: aiAnalysis.score,
            matchPercentage: aiAnalysis.matchPercentage,
            enrichmentData: aiAnalysis.enrichmentData
          });
          
          res.json(aiAnalysis);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error in analyze-lead endpoint:", error);
      res.status(500).json({ message: "Failed to analyze lead with Gemini AI" });
    }
  });

  app.post("/api/gemini/generate-message", async (req: Request, res: Response) => {
    try {
      const { leadId, messageType, context } = req.body;
      
      if (!leadId || !messageType) {
        return res.status(400).json({ message: "Lead ID and message type are required" });
      }
      
      const lead = await storage.getLead(parseInt(leadId));
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/gemini');
      
      try {
        // Call the Gemini API to generate a message
        const result = await geminiService.generateMessage(lead, messageType, context);
        res.json(result);
      } catch (error: any) {
        // Check if error is related to missing API key
        if (error.message === 'GEMINI_API_KEY is not set') {
          // Fallback to sample data if API key is missing
          let generatedContent = "";
          
          switch (messageType) {
            case "follow-up":
              generatedContent = `Hi ${lead.fullName},\n\nThank you for your interest in our services. I wanted to follow up on our previous conversation and see if you have any questions I can help with.\n\nLooking forward to hearing from you,\nThe Sales Team`;
              break;
            case "proposal":
              generatedContent = `Dear ${lead.fullName},\n\nBased on our conversation, I've prepared a custom proposal for ${lead.company || 'your company'}. Our solution will address your specific needs and help you achieve your goals.\n\nLet me know if you'd like to discuss this proposal in more detail.\n\nBest regards,\nThe Sales Team`;
              break;
            case "meeting-request":
              generatedContent = `Hi ${lead.fullName},\n\nI would love to schedule a meeting to discuss how our services can benefit ${lead.company || 'your company'}. Would you be available for a 30-minute call next week?\n\nBest regards,\nThe Sales Team`;
              break;
            default:
              generatedContent = `Hi ${lead.fullName},\n\nThank you for your interest in our services. How can I help you today?\n\nBest regards,\nThe Sales Team`;
          }
          
          res.json({ content: generatedContent });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error in generate-message endpoint:", error);
      res.status(500).json({ message: "Failed to generate message with Gemini AI" });
    }
  });

  app.post("/api/gemini/chat", async (req: Request, res: Response) => {
    try {
      const { message, history } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/gemini');
      
      try {
        // Call the Gemini API to get a chat response
        const response = await geminiService.chat(message, history);
        res.json(response);
      } catch (error: any) {
        // Check if error is related to missing API key
        if (error.message === 'GEMINI_API_KEY is not set') {
          // Fallback to sample data if API key is missing
          const response = {
            role: "assistant" as const,
            content: "I'm your CRM assistant. I can help with lead analysis, content generation, and providing insights for your sales process. What specific task would you like assistance with today?"
          };
          
          res.json(response);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error in chat endpoint:", error);
      res.status(500).json({ message: "Failed to chat with Gemini AI" });
    }
  });
  
  // Additional Gemini endpoint for next best action
  app.post("/api/gemini/suggest-action", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.body;
      
      if (!leadId) {
        return res.status(400).json({ message: "Lead ID is required" });
      }
      
      const lead = await storage.getLead(parseInt(leadId));
      
      if (!lead) {
        return res.status(404).json({ message: "Lead not found" });
      }
      
      // Import the Gemini service
      const { geminiService } = await import('./services/gemini');
      
      try {
        // Call the Gemini API to suggest the next best action
        const suggestion = await geminiService.suggestNextAction(lead);
        res.json(suggestion);
      } catch (error: any) {
        // Check if error is related to missing API key
        if (error.message === 'GEMINI_API_KEY is not set') {
          // Fallback to sample data if API key is missing
          const suggestion = {
            recommendedAction: "Schedule a follow-up call",
            actionType: "call",
            priority: "medium",
            reasoning: "It's been a while since the last contact, and a call would help re-establish the relationship",
            suggestedSchedule: "Next week",
            talkingPoints: [
              "Discuss their current needs and challenges",
              "Introduce new features or solutions",
              "Gather feedback on previous interactions"
            ]
          };
          
          res.json(suggestion);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("Error in suggest-action endpoint:", error);
      res.status(500).json({ message: "Failed to suggest action with Gemini AI" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
