import { automaticChatToLeadService } from './automaticChatToLeadService';
import { db } from '../db';
import { whatsappMessages } from '../../shared/schema';
import { desc, sql } from 'drizzle-orm';

/**
 * Background service that monitors for new WhatsApp messages
 * and automatically converts chats to leads when new activity is detected
 */
export class BackgroundChatMonitor {
  private static instance: BackgroundChatMonitor;
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastProcessedTimestamp: Date | null = null;
  private readonly MONITOR_INTERVAL = 30000; // 30 seconds
  private readonly BATCH_SIZE = 50;

  public static getInstance(): BackgroundChatMonitor {
    if (!BackgroundChatMonitor.instance) {
      BackgroundChatMonitor.instance = new BackgroundChatMonitor();
    }
    return BackgroundChatMonitor.instance;
  }

  /**
   * Start the background monitoring service
   */
  public start(): void {
    if (this.isRunning) {
      console.log('🔄 Background chat monitor already running');
      return;
    }

    console.log('🚀 Starting background chat-to-lead monitor...');
    this.isRunning = true;
    this.lastProcessedTimestamp = new Date();

    // Start monitoring loop
    this.intervalId = setInterval(async () => {
      await this.checkForNewMessages();
    }, this.MONITOR_INTERVAL);

    console.log(`✅ Background monitor started (checking every ${this.MONITOR_INTERVAL/1000}s)`);
  }

  /**
   * Stop the background monitoring service
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping background chat monitor...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log('✅ Background monitor stopped');
  }

  /**
   * Check for new messages since last check and trigger conversion if needed
   */
  private async checkForNewMessages(): Promise<void> {
    try {
      if (!this.lastProcessedTimestamp) {
        this.lastProcessedTimestamp = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      }

      // Check for new incoming messages since last check
      const newMessages = await db
        .select({
          id: whatsappMessages.id,
          messageId: whatsappMessages.messageId,
          timestamp: whatsappMessages.timestamp,
          from_me: whatsappMessages.from_me,
          accountId: whatsappMessages.accountId
        })
        .from(whatsappMessages)
        .where(
          sql`${whatsappMessages.timestamp} > ${this.lastProcessedTimestamp} 
              AND ${whatsappMessages.from_me} = false`
        )
        .orderBy(desc(whatsappMessages.timestamp))
        .limit(this.BATCH_SIZE);

      if (newMessages.length > 0) {
        console.log(`🔍 Detected ${newMessages.length} new incoming messages - triggering auto-conversion`);
        
        // Update last processed timestamp
        this.lastProcessedTimestamp = newMessages[0].timestamp;

        // Trigger automatic chat-to-lead conversion
        await this.processNewChatsToLeads();
      } else {
        console.log(`✅ No new messages detected since ${this.lastProcessedTimestamp.toISOString()}`);
      }

    } catch (error) {
      console.error('❌ Error checking for new messages:', error);
    }
  }

  /**
   * Process new chats and convert eligible ones to leads
   */
  private async processNewChatsToLeads(): Promise<void> {
    try {
      console.log('🔄 Processing new chats for automatic lead conversion...');
      
      const result = await automaticChatToLeadService.processAllChatsToLeads();
      
      if (result.converted > 0) {
        console.log(`✅ Auto-conversion completed: ${result.converted} new leads created from ${result.processed} conversations`);
        
        // Broadcast the conversion results via WebSocket if available
        this.broadcastConversionResults(result);
      } else {
        console.log(`📊 Auto-conversion check complete: No new leads created (${result.processed} conversations checked)`);
      }

    } catch (error) {
      console.error('❌ Error in automatic chat-to-lead processing:', error);
    }
  }

  /**
   * Broadcast conversion results to connected clients
   */
  private broadcastConversionResults(result: any): void {
    try {
      // This will be used to notify the frontend about new leads
      const notification = {
        type: 'auto_conversion_complete',
        data: {
          converted: result.converted,
          processed: result.processed,
          timestamp: new Date().toISOString(),
          details: result.details?.slice(0, 5) // Send only first 5 for brevity
        }
      };

      console.log('📢 Broadcasting auto-conversion results:', notification);
      // WebSocket broadcasting will be implemented in the main server file
      
    } catch (error) {
      console.error('❌ Error broadcasting conversion results:', error);
    }
  }

  /**
   * Get current monitor status
   */
  public getStatus(): {
    isRunning: boolean;
    lastCheck: Date | null;
    monitorInterval: number;
  } {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastProcessedTimestamp,
      monitorInterval: this.MONITOR_INTERVAL
    };
  }

  /**
   * Force immediate check for new messages
   */
  public async forceCheck(): Promise<void> {
    console.log('🔧 Forcing immediate check for new messages...');
    await this.checkForNewMessages();
  }

  /**
   * Reset the last processed timestamp to reprocess older messages
   */
  public resetTimestamp(hoursBack: number = 24): void {
    this.lastProcessedTimestamp = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    console.log(`🔄 Reset monitor timestamp to ${hoursBack} hours ago: ${this.lastProcessedTimestamp.toISOString()}`);
  }
}

export const backgroundChatMonitor = BackgroundChatMonitor.getInstance();