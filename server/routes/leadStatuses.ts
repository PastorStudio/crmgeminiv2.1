import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Available lead statuses
const defaultStatuses = [
  { name: 'new', displayName: 'New' },
  { name: 'contacted', displayName: 'Contacted' },
  { name: 'qualified', displayName: 'Qualified' },
  { name: 'meeting', displayName: 'Meeting' },
  { name: 'proposal', displayName: 'Proposal' },
  { name: 'negotiation', displayName: 'Negotiation' },
  { name: 'closed-won', displayName: 'Closed Won' },
  { name: 'closed-lost', displayName: 'Closed Lost' },
  { name: 'assigned', displayName: 'Assigned' },
  { name: 'interested', displayName: 'Interested' }
];

let customStatuses: Array<{ name: string; displayName: string }> = [];

// Get all available statuses
router.get('/', async (req, res) => {
  try {
    const allStatuses = [...defaultStatuses, ...customStatuses];
    
    res.json({
      success: true,
      statuses: allStatuses
    });
    
  } catch (error) {
    console.error('❌ Error getting lead statuses:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get lead statuses',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new status
router.post('/', async (req, res) => {
  try {
    const createStatusSchema = z.object({
      name: z.string().min(1, 'Status name is required'),
      displayName: z.string().min(1, 'Display name is required')
    });

    const { name, displayName } = createStatusSchema.parse(req.body);
    
    // Check if status already exists
    const allStatuses = [...defaultStatuses, ...customStatuses];
    const existingStatus = allStatuses.find(status => 
      status.name.toLowerCase() === name.toLowerCase() || 
      status.displayName.toLowerCase() === displayName.toLowerCase()
    );

    if (existingStatus) {
      return res.status(400).json({
        success: false,
        error: 'Status already exists',
        message: `A status with name "${name}" or display name "${displayName}" already exists`
      });
    }

    // Add new status
    const newStatus = {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      displayName: displayName
    };

    customStatuses.push(newStatus);
    
    console.log(`✅ Created new lead status: ${displayName} (${newStatus.name})`);

    res.json({
      success: true,
      status: newStatus,
      message: `Status "${displayName}" created successfully`
    });

  } catch (error) {
    console.error('❌ Error creating lead status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create lead status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete custom status
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    // Check if it's a default status
    const isDefaultStatus = defaultStatuses.some(status => status.name === name);
    if (isDefaultStatus) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete default status',
        message: 'Default statuses cannot be deleted'
      });
    }

    // Remove from custom statuses
    const initialLength = customStatuses.length;
    customStatuses = customStatuses.filter(status => status.name !== name);
    
    if (customStatuses.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: 'Status not found',
        message: `Custom status "${name}" not found`
      });
    }

    console.log(`✅ Deleted custom lead status: ${name}`);

    res.json({
      success: true,
      message: `Status "${name}" deleted successfully`
    });

  } catch (error) {
    console.error('❌ Error deleting lead status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete lead status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;