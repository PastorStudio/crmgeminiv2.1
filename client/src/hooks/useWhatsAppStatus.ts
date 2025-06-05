import { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../lib/queryClient';

// Centralized WhatsApp status management to prevent conflicts between pages
class WhatsAppStatusManager {
  private static instance: WhatsAppStatusManager;
  private listeners: Set<(status: boolean | null) => void> = new Set();
  private currentStatus: boolean | null = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private isChecking = false;
  private lastCheckTime = 0;
  private readonly CHECK_INTERVAL = 45000; // 45 seconds
  private readonly MIN_CHECK_DELAY = 5000; // Minimum 5 seconds between checks

  static getInstance(): WhatsAppStatusManager {
    if (!WhatsAppStatusManager.instance) {
      WhatsAppStatusManager.instance = new WhatsAppStatusManager();
    }
    return WhatsAppStatusManager.instance;
  }

  private constructor() {
    this.startPeriodicCheck();
  }

  subscribe(callback: (status: boolean | null) => void): () => void {
    this.listeners.add(callback);
    
    // Immediately provide current status
    callback(this.currentStatus);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
      
      // If no more listeners, stop checking
      if (this.listeners.size === 0) {
        this.stopPeriodicCheck();
      }
    };
  }

  private notifyListeners(status: boolean | null) {
    this.currentStatus = status;
    this.listeners.forEach(callback => callback(status));
  }

  private async checkWhatsAppStatus(): Promise<boolean> {
    // Prevent concurrent checks
    if (this.isChecking) {
      return this.currentStatus ?? false;
    }

    // Rate limiting
    const now = Date.now();
    if (now - this.lastCheckTime < this.MIN_CHECK_DELAY) {
      return this.currentStatus ?? false;
    }

    this.isChecking = true;
    this.lastCheckTime = now;

    try {
      // Primary method: Check ping status for all accounts
      const pingResponse = await fetch('/api/whatsapp/ping-status/all');
      if (pingResponse.ok) {
        const pingData = await pingResponse.json();
        if (pingData.success && pingData.accounts) {
          const hasActiveAccount = pingData.accounts.some((acc: any) => 
            acc.pingStatus && acc.pingStatus.isActive
          );
          if (hasActiveAccount) {
            console.log('✅ WhatsApp connected - Active account found via centralized ping status');
            return true;
          }
        }
      }

      // Secondary method: Check integration status
      const integrationResponse = await fetch('/api/integrations/whatsapp/status');
      if (integrationResponse.ok) {
        const integrationData = await integrationResponse.json();
        if (integrationData.authenticated || integrationData.ready) {
          console.log('✅ WhatsApp connected via centralized integration status');
          return true;
        }
      }

      console.log('❌ WhatsApp appears to be disconnected - centralized check');
      return false;
    } catch (error) {
      console.error('❌ Error in centralized WhatsApp status check:', error);
      return false;
    } finally {
      this.isChecking = false;
    }
  }

  private startPeriodicCheck() {
    // Initial check
    this.checkWhatsAppStatus().then(status => {
      this.notifyListeners(status);
    });

    // Periodic checks
    this.checkInterval = setInterval(async () => {
      if (this.listeners.size > 0) {
        const status = await this.checkWhatsAppStatus();
        this.notifyListeners(status);
      }
    }, this.CHECK_INTERVAL);
  }

  private stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Manual refresh method for components that need immediate updates
  async refresh(): Promise<boolean> {
    const status = await this.checkWhatsAppStatus();
    this.notifyListeners(status);
    return status;
  }
}

// Custom hook for components to use WhatsApp status
export function useWhatsAppStatus() {
  const [status, setStatus] = useState<boolean | null>(null);
  const statusManager = useRef<WhatsAppStatusManager>();

  useEffect(() => {
    statusManager.current = WhatsAppStatusManager.getInstance();
    
    const unsubscribe = statusManager.current.subscribe(setStatus);
    
    return unsubscribe;
  }, []);

  const refresh = async () => {
    if (statusManager.current) {
      return await statusManager.current.refresh();
    }
    return false;
  };

  return { status, refresh };
}