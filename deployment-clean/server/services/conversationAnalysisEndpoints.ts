/**
 * API Endpoints for Conversation Analysis Service
 * Provides REST endpoints to monitor and control the conversation analysis system
 */

import { Request, Response } from 'express';
import { conversationAnalysisService } from './conversationAnalysis';

/**
 * Get conversation analysis status
 */
export const getAnalysisStatus = async (req: Request, res: Response) => {
  try {
    const status = conversationAnalysisService.getStatus();
    
    res.json({
      success: true,
      status,
      message: status.running ? 'Sistema de análisis activo' : 'Sistema de análisis inactivo'
    });
  } catch (error) {
    console.error('Error obteniendo estado de análisis:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo estado del análisis de conversaciones'
    });
  }
};

/**
 * Start conversation analysis service manually
 */
export const startAnalysis = async (req: Request, res: Response) => {
  try {
    conversationAnalysisService.start();
    
    res.json({
      success: true,
      message: 'Sistema de análisis de conversaciones iniciado'
    });
  } catch (error) {
    console.error('Error iniciando análisis:', error);
    res.status(500).json({
      success: false,
      error: 'Error iniciando el análisis de conversaciones'
    });
  }
};

/**
 * Stop conversation analysis service
 */
export const stopAnalysis = async (req: Request, res: Response) => {
  try {
    conversationAnalysisService.stop();
    
    res.json({
      success: true,
      message: 'Sistema de análisis de conversaciones detenido'
    });
  } catch (error) {
    console.error('Error deteniendo análisis:', error);
    res.status(500).json({
      success: false,
      error: 'Error deteniendo el análisis de conversaciones'
    });
  }
};

/**
 * Get analysis insights for a specific account
 */
export const getAccountInsights = async (req: Request, res: Response) => {
  try {
    const accountId = parseInt(req.params.accountId);
    
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'ID de cuenta requerido'
      });
    }

    // This would typically fetch insights from the database
    // For now, return status information
    const status = conversationAnalysisService.getStatus();
    
    res.json({
      success: true,
      accountId,
      analysisActive: status.running,
      accountsMonitored: status.accountsMonitored,
      message: `Análisis ${status.running ? 'activo' : 'inactivo'} para cuenta ${accountId}`
    });
  } catch (error) {
    console.error('Error obteniendo insights de cuenta:', error);
    res.status(500).json({
      success: false,
      error: 'Error obteniendo insights de la cuenta'
    });
  }
};