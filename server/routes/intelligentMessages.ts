/**
 * API routes for intelligent messaging system
 */

import express from 'express';
import { intelligentAutoResponse } from '../services/intelligentAutoResponse.js';

const router = express.Router();

// Process intelligent message
router.post('/process-message', async (req, res) => {
  try {
    const { accountId, chatId, message, fromNumber } = req.body;
    
    if (!accountId || !chatId || !message || !fromNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const response = await intelligentAutoResponse.processIntelligentMessage(
      parseInt(accountId),
      chatId,
      message,
      fromNumber
    );

    if (response) {
      res.json({
        success: true,
        response: {
          message: response.message,
          confidence: response.confidence || 85,
          needsHumanIntervention: response.needsHumanIntervention || false
        }
      });
    } else {
      res.json({
        success: false,
        error: 'Could not generate response'
      });
    }
  } catch (error) {
    console.error('Error in intelligent message processing:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;