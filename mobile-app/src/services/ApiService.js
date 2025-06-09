import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure your server URL here
const BASE_URL = 'http://172.31.128.27:5000'; // Change to your actual server URL

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // Dashboard Methods
  async getDashboardStats() {
    try {
      const response = await this.api.get('/api/leads');
      const leads = response.data;
      
      const stats = {
        totalLeads: leads.length,
        newLeads: leads.filter(lead => lead.status === 'new').length,
        qualifiedLeads: leads.filter(lead => lead.status === 'qualified').length,
        closedWon: leads.filter(lead => lead.status === 'closed-won').length,
        totalRevenue: leads.reduce((sum, lead) => sum + (lead.value || 0), 0),
        conversionRate: leads.length > 0 ? 
          (leads.filter(lead => lead.status === 'closed-won').length / leads.length * 100).toFixed(1) : 0
      };
      
      return stats;
    } catch (error) {
      throw new Error('Error fetching dashboard stats: ' + error.message);
    }
  }

  // WhatsApp Methods
  async getWhatsAppAccounts() {
    try {
      const response = await this.api.get('/api/whatsapp-accounts');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching WhatsApp accounts: ' + error.message);
    }
  }

  async getWhatsAppMessages() {
    try {
      const response = await this.api.get('/api/direct/whatsapp/chats');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching WhatsApp messages: ' + error.message);
    }
  }

  // Leads Methods
  async getLeads() {
    try {
      const response = await this.api.get('/api/leads');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching leads: ' + error.message);
    }
  }

  async createLead(leadData) {
    try {
      const response = await this.api.post('/api/leads', leadData);
      return response.data;
    } catch (error) {
      throw new Error('Error creating lead: ' + error.message);
    }
  }

  async updateLeadStatus(leadId, status) {
    try {
      const response = await this.api.patch(`/api/leads/${leadId}/status`, { status });
      return response.data;
    } catch (error) {
      throw new Error('Error updating lead status: ' + error.message);
    }
  }

  async convertWhatsAppChatsToLeads() {
    try {
      const response = await this.api.post('/bypass/generate-real-leads');
      return response.data;
    } catch (error) {
      throw new Error('Error converting chats to leads: ' + error.message);
    }
  }

  // Templates Methods
  async getMessageTemplates() {
    try {
      const response = await this.api.get('/api/message-templates');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching message templates: ' + error.message);
    }
  }

  async createMessageTemplate(templateData) {
    try {
      const response = await this.api.post('/api/message-templates', templateData);
      return response.data;
    } catch (error) {
      throw new Error('Error creating message template: ' + error.message);
    }
  }

  async updateMessageTemplate(templateId, templateData) {
    try {
      const response = await this.api.patch(`/api/message-templates/${templateId}`, templateData);
      return response.data;
    } catch (error) {
      throw new Error('Error updating message template: ' + error.message);
    }
  }

  async deleteMessageTemplate(templateId) {
    try {
      const response = await this.api.delete(`/api/message-templates/${templateId}`);
      return response.data;
    } catch (error) {
      throw new Error('Error deleting message template: ' + error.message);
    }
  }

  // Contacts Methods
  async getContacts() {
    try {
      const response = await this.api.get('/api/contacts');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching contacts: ' + error.message);
    }
  }

  // Campaign Methods
  async sendBulkMessage(templateId, contacts, variables = {}) {
    try {
      const response = await this.api.post('/api/campaigns/send', {
        templateId,
        contacts,
        variables
      });
      return response.data;
    } catch (error) {
      throw new Error('Error sending bulk message: ' + error.message);
    }
  }

  // Agent Activity Methods
  async getAgentActivities() {
    try {
      const response = await this.api.get('/api/agent-activities');
      return response.data;
    } catch (error) {
      throw new Error('Error fetching agent activities: ' + error.message);
    }
  }

  // AI Methods
  async analyzeLeadWithAI(leadId) {
    try {
      const response = await this.api.post(`/api/ai/analyze-lead/${leadId}`);
      return response.data;
    } catch (error) {
      throw new Error('Error analyzing lead with AI: ' + error.message);
    }
  }

  async generateAIResponse(message, context = {}) {
    try {
      const response = await this.api.post('/api/ai/process-message', {
        message,
        context
      });
      return response.data;
    } catch (error) {
      throw new Error('Error generating AI response: ' + error.message);
    }
  }
}

export default new ApiService();