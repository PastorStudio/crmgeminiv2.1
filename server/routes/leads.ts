import { Router } from 'express';
import { storage } from '../storage';
import { z } from 'zod';

const router = Router();

// Clear WhatsApp leads from database
router.delete('/clear-whatsapp', async (req, res) => {
  try {
    console.log('🗑️ Clearing WhatsApp leads from database...');
    
    const leads = await storage.getLeads();
    const whatsappLeads = leads.filter(lead => 
      lead.source === 'whatsapp' || 
      lead.tags?.includes('whatsapp-demo') ||
      lead.tags?.includes('whatsapp-real') ||
      lead.tags?.includes('whatsapp-fallback') ||
      lead.email?.includes('@whatsapp.contact')
    );

    let deletedCount = 0;
    
    for (const lead of whatsappLeads) {
      try {
        await storage.deleteLead(lead.id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting lead ${lead.id}:`, error);
      }
    }

    console.log(`✅ Deleted ${deletedCount} WhatsApp leads`);

    res.json({
      success: true,
      deleted: deletedCount,
      message: `Successfully deleted ${deletedCount} WhatsApp leads`
    });

  } catch (error) {
    console.error('❌ Error clearing WhatsApp leads:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear WhatsApp leads',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get lead statistics
router.get('/stats', async (req, res) => {
  try {
    const leads = await storage.getLeads();
    
    const stats = {
      total: leads.length,
      whatsapp: leads.filter(lead => lead.source === 'whatsapp').length,
      byStatus: leads.reduce((acc, lead) => {
        acc[lead.status] = (acc[lead.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: leads.reduce((acc, lead) => {
        acc[lead.priority] = (acc[lead.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error getting lead stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get lead statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;