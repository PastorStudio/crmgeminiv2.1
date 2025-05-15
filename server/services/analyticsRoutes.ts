import { Express, Request, Response } from "express";
import { analyticsService } from "./analyticsService";

export function registerAnalyticsRoutes(app: Express) {
  /**
   * Endpoint para predecir métricas futuras
   * @route GET /api/analytics/predict/:metric
   */
  app.get("/api/analytics/predict/:metric", async (req: Request, res: Response) => {
    try {
      const { metric } = req.params;
      const { startDate, endDate, leadId, campaignId, category } = req.query;
      
      const params = {
        startDate: startDate as string,
        endDate: endDate as string,
        leadId: leadId ? parseInt(leadId as string) : undefined,
        campaignId: campaignId as string,
        category: category as string
      };
      
      const prediction = await analyticsService.predictMetrics(metric, params);
      
      res.json({
        success: true,
        prediction
      });
    } catch (error: any) {
      console.error("Error al predecir métricas:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al predecir métricas"
      });
    }
  });

  /**
   * Endpoint para generar insights a partir de los datos
   * @route GET /api/analytics/insights
   */
  app.get("/api/analytics/insights", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, leadId, campaignId, category } = req.query;
      
      const params = {
        startDate: startDate as string,
        endDate: endDate as string,
        leadId: leadId ? parseInt(leadId as string) : undefined,
        campaignId: campaignId as string,
        category: category as string
      };
      
      const insights = await analyticsService.generateInsights(params);
      
      res.json({
        success: true,
        insights
      });
    } catch (error: any) {
      console.error("Error al generar insights:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al generar insights"
      });
    }
  });

  /**
   * Endpoint para analizar sentimiento y temas de los mensajes
   * @route GET /api/analytics/feedback
   */
  app.get("/api/analytics/feedback", async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, leadId } = req.query;
      
      const params = {
        startDate: startDate as string,
        endDate: endDate as string,
        leadId: leadId ? parseInt(leadId as string) : undefined
      };
      
      const analysis = await analyticsService.analyzeCustomerFeedback(params);
      
      res.json({
        success: true,
        analysis
      });
    } catch (error: any) {
      console.error("Error al analizar feedback:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al analizar feedback"
      });
    }
  });

  /**
   * Endpoint para segmentar clientes basado en comportamiento
   * @route GET /api/analytics/segments
   */
  app.get("/api/analytics/segments", async (req: Request, res: Response) => {
    try {
      const segmentation = await analyticsService.segmentCustomers();
      
      res.json({
        success: true,
        segmentation
      });
    } catch (error: any) {
      console.error("Error al segmentar clientes:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al segmentar clientes"
      });
    }
  });

  /**
   * Endpoint para predecir la probabilidad de conversión de leads
   * @route GET /api/analytics/leads/conversion
   */
  app.get("/api/analytics/leads/conversion", async (req: Request, res: Response) => {
    try {
      const { leadId } = req.query;
      
      const predictions = await analyticsService.predictLeadConversion(
        leadId ? parseInt(leadId as string) : undefined
      );
      
      res.json({
        success: true,
        predictions
      });
    } catch (error: any) {
      console.error("Error al predecir conversión de leads:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al predecir conversión de leads"
      });
    }
  });

  /**
   * Estado del servicio de análisis
   * @route GET /api/analytics/status
   */
  app.get("/api/analytics/status", (req: Request, res: Response) => {
    try {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      
      res.json({
        success: true,
        status: {
          available: hasGeminiKey,
          message: hasGeminiKey 
            ? "Servicio de análisis avanzado disponible" 
            : "Se requiere una clave API de Gemini para el análisis avanzado"
        }
      });
    } catch (error: any) {
      console.error("Error al verificar estado del servicio de análisis:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Error al verificar estado del servicio de análisis"
      });
    }
  });
}