import { 
  users, 
  leads, 
  activities, 
  messages, 
  surveys, 
  dashboardStats,
  type User, 
  type InsertUser,
  type Lead,
  type InsertLead,
  type Activity,
  type InsertActivity,
  type Message,
  type InsertMessage,
  type Survey,
  type InsertSurvey,
  type DashboardStats,
  type InsertDashboardStats
} from "@shared/schema";

// Interface for storage methods
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Lead methods
  getLead(id: number): Promise<Lead | undefined>;
  getLeadsByStatus(status: string): Promise<Lead[]>;
  getLeadsByAssignee(userId: number): Promise<Lead[]>;
  getAllLeads(): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined>;
  updateLeadStatus(id: number, status: string): Promise<Lead | undefined>;

  // Activity methods
  getActivity(id: number): Promise<Activity | undefined>;
  getActivitiesByLead(leadId: number): Promise<Activity[]>;
  getActivitiesByUser(userId: number): Promise<Activity[]>;
  getUpcomingActivities(userId: number, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined>;
  completeActivity(id: number): Promise<Activity | undefined>;

  // Message methods
  getMessage(id: number): Promise<Message | undefined>;
  getMessagesByLead(leadId: number): Promise<Message[]>;
  getRecentMessages(limit?: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;

  // Survey methods
  getSurvey(id: number): Promise<Survey | undefined>;
  getSurveysByLead(leadId: number): Promise<Survey[]>;
  createSurvey(survey: InsertSurvey): Promise<Survey>;
  updateSurveyResponses(id: number, responses: any): Promise<Survey | undefined>;

  // Dashboard stats methods
  getDashboardStats(): Promise<DashboardStats | undefined>;
  updateDashboardStats(stats: InsertDashboardStats): Promise<DashboardStats>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private usersData: Map<number, User>;
  private leadsData: Map<number, Lead>;
  private activitiesData: Map<number, Activity>;
  private messagesData: Map<number, Message>;
  private surveysData: Map<number, Survey>;
  private dashboardStatsData: Map<number, DashboardStats>;
  
  private userIdCounter: number;
  private leadIdCounter: number;
  private activityIdCounter: number;
  private messageIdCounter: number;
  private surveyIdCounter: number;
  private statsIdCounter: number;

  constructor() {
    this.usersData = new Map();
    this.leadsData = new Map();
    this.activitiesData = new Map();
    this.messagesData = new Map();
    this.surveysData = new Map();
    this.dashboardStatsData = new Map();
    
    this.userIdCounter = 1;
    this.leadIdCounter = 1;
    this.activityIdCounter = 1;
    this.messageIdCounter = 1;
    this.surveyIdCounter = 1;
    this.statsIdCounter = 1;

    // Initialize with sample user
    this.createUser({
      username: "sarahjohnson",
      password: "password123", // In a real app, this would be hashed
      fullName: "Sarah Johnson",
      email: "sarah@example.com",
      role: "Sales Manager",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    });

    // Initialize with sample dashboard stats
    this.updateDashboardStats({
      totalLeads: 1652,
      conversionRate: 2450, // 24.5%
      activeConversations: 42,
      todayMeetings: 8,
      leadsByStatus: {
        new: 12,
        contacted: 8,
        meeting: 5,
        "closed-won": 5,
        "closed-lost": 2
      }
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.usersData.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersData.values()).find(
      user => user.username === username
    );
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const createdAt = new Date();
    const newUser: User = { ...user, id, createdAt };
    this.usersData.set(id, newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.usersData.values());
  }

  // Lead methods
  async getLead(id: number): Promise<Lead | undefined> {
    return this.leadsData.get(id);
  }

  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return Array.from(this.leadsData.values()).filter(
      lead => lead.status === status
    );
  }

  async getLeadsByAssignee(userId: number): Promise<Lead[]> {
    return Array.from(this.leadsData.values()).filter(
      lead => lead.assignedTo === userId
    );
  }

  async getAllLeads(): Promise<Lead[]> {
    return Array.from(this.leadsData.values());
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const id = this.leadIdCounter++;
    const createdAt = new Date();
    const newLead: Lead = { ...lead, id, createdAt };
    this.leadsData.set(id, newLead);
    
    // Update dashboard stats
    const stats = await this.getDashboardStats();
    if (stats) {
      stats.totalLeads += 1;
      if (lead.status && stats.leadsByStatus) {
        const status = lead.status as keyof typeof stats.leadsByStatus;
        stats.leadsByStatus[status] = (stats.leadsByStatus[status] || 0) + 1;
      }
      stats.updatedAt = new Date();
      this.dashboardStatsData.set(stats.id, stats);
    }
    
    return newLead;
  }

  async updateLead(id: number, lead: Partial<InsertLead>): Promise<Lead | undefined> {
    const existingLead = this.leadsData.get(id);
    if (!existingLead) return undefined;

    const updatedLead: Lead = { ...existingLead, ...lead };
    this.leadsData.set(id, updatedLead);
    return updatedLead;
  }

  async updateLeadStatus(id: number, status: string): Promise<Lead | undefined> {
    const existingLead = this.leadsData.get(id);
    if (!existingLead) return undefined;

    // Update dashboard stats
    const stats = await this.getDashboardStats();
    if (stats && stats.leadsByStatus) {
      const oldStatus = existingLead.status as keyof typeof stats.leadsByStatus;
      const newStatus = status as keyof typeof stats.leadsByStatus;
      
      if (oldStatus) {
        stats.leadsByStatus[oldStatus] = Math.max((stats.leadsByStatus[oldStatus] || 0) - 1, 0);
      }
      
      stats.leadsByStatus[newStatus] = (stats.leadsByStatus[newStatus] || 0) + 1;
      stats.updatedAt = new Date();
      this.dashboardStatsData.set(stats.id, stats);
    }

    const updatedLead: Lead = { ...existingLead, status };
    this.leadsData.set(id, updatedLead);
    return updatedLead;
  }

  // Activity methods
  async getActivity(id: number): Promise<Activity | undefined> {
    return this.activitiesData.get(id);
  }

  async getActivitiesByLead(leadId: number): Promise<Activity[]> {
    return Array.from(this.activitiesData.values()).filter(
      activity => activity.leadId === leadId
    );
  }

  async getActivitiesByUser(userId: number): Promise<Activity[]> {
    return Array.from(this.activitiesData.values()).filter(
      activity => activity.userId === userId
    );
  }

  async getUpcomingActivities(userId: number, limit: number = 10): Promise<Activity[]> {
    const now = new Date();
    return Array.from(this.activitiesData.values())
      .filter(activity => activity.userId === userId && 
              activity.startTime && new Date(activity.startTime) >= now &&
              !activity.completed)
      .sort((a, b) => {
        if (!a.startTime || !b.startTime) return 0;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      })
      .slice(0, limit);
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const id = this.activityIdCounter++;
    const createdAt = new Date();
    const newActivity: Activity = { ...activity, id, createdAt };
    this.activitiesData.set(id, newActivity);
    
    // Update today's meetings count if the activity is a meeting scheduled for today
    if (activity.type === 'meeting' && activity.startTime) {
      const today = new Date();
      const activityDate = new Date(activity.startTime);
      if (activityDate.getDate() === today.getDate() &&
          activityDate.getMonth() === today.getMonth() &&
          activityDate.getFullYear() === today.getFullYear()) {
        const stats = await this.getDashboardStats();
        if (stats) {
          stats.todayMeetings += 1;
          stats.updatedAt = new Date();
          this.dashboardStatsData.set(stats.id, stats);
        }
      }
    }
    
    return newActivity;
  }

  async updateActivity(id: number, activity: Partial<InsertActivity>): Promise<Activity | undefined> {
    const existingActivity = this.activitiesData.get(id);
    if (!existingActivity) return undefined;

    const updatedActivity: Activity = { ...existingActivity, ...activity };
    this.activitiesData.set(id, updatedActivity);
    return updatedActivity;
  }

  async completeActivity(id: number): Promise<Activity | undefined> {
    const existingActivity = this.activitiesData.get(id);
    if (!existingActivity) return undefined;

    const updatedActivity: Activity = { ...existingActivity, completed: true };
    this.activitiesData.set(id, updatedActivity);
    return updatedActivity;
  }

  // Message methods
  async getMessage(id: number): Promise<Message | undefined> {
    return this.messagesData.get(id);
  }

  async getMessagesByLead(leadId: number): Promise<Message[]> {
    return Array.from(this.messagesData.values())
      .filter(message => message.leadId === leadId)
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  }

  async getRecentMessages(limit: number = 10): Promise<Message[]> {
    return Array.from(this.messagesData.values())
      .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())
      .slice(0, limit);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const sentAt = new Date();
    const newMessage: Message = { ...message, id, sentAt };
    this.messagesData.set(id, newMessage);
    
    // Update active conversations count
    const stats = await this.getDashboardStats();
    if (stats) {
      // Only count as a new conversation if this is the first message with this lead
      const existingMessages = await this.getMessagesByLead(message.leadId);
      if (existingMessages.length === 0) {
        stats.activeConversations += 1;
        stats.updatedAt = new Date();
        this.dashboardStatsData.set(stats.id, stats);
      }
    }
    
    return newMessage;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const existingMessage = this.messagesData.get(id);
    if (!existingMessage) return undefined;

    const updatedMessage: Message = { ...existingMessage, read: true };
    this.messagesData.set(id, updatedMessage);
    return updatedMessage;
  }

  // Survey methods
  async getSurvey(id: number): Promise<Survey | undefined> {
    return this.surveysData.get(id);
  }

  async getSurveysByLead(leadId: number): Promise<Survey[]> {
    return Array.from(this.surveysData.values()).filter(
      survey => survey.leadId === leadId
    );
  }

  async createSurvey(survey: InsertSurvey): Promise<Survey> {
    const id = this.surveyIdCounter++;
    const sentAt = new Date();
    const newSurvey: Survey = { ...survey, id, sentAt };
    this.surveysData.set(id, newSurvey);
    return newSurvey;
  }

  async updateSurveyResponses(id: number, responses: any): Promise<Survey | undefined> {
    const existingSurvey = this.surveysData.get(id);
    if (!existingSurvey) return undefined;

    const completedAt = new Date();
    const updatedSurvey: Survey = { ...existingSurvey, responses, completedAt };
    this.surveysData.set(id, updatedSurvey);
    return updatedSurvey;
  }

  // Dashboard stats methods
  async getDashboardStats(): Promise<DashboardStats | undefined> {
    // Return the first stats object (there should only be one)
    return Array.from(this.dashboardStatsData.values())[0];
  }

  async updateDashboardStats(stats: InsertDashboardStats): Promise<DashboardStats> {
    const id = this.statsIdCounter++;
    const updatedAt = new Date();
    const newStats: DashboardStats = { ...stats, id, updatedAt };
    this.dashboardStatsData.set(id, newStats);
    return newStats;
  }
}

export const storage = new MemStorage();
