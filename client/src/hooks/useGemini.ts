import { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from './use-toast';

interface GenerateMessageResponse {
  success: boolean;
  message: string;
}

interface AnalyzeLeadResponse {
  success: boolean;
  analysis: string;
}

export function useGemini() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Genera un mensaje para un lead específico
   * @param leadId ID del lead para el cual generar el mensaje
   * @param messageType Tipo de mensaje a generar (follow-up, welcome, proposal, etc.)
   * @returns Texto del mensaje generado
   */
  const generateMessage = async (leadId: number, messageType: string): Promise<string> => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest<GenerateMessageResponse>({
        url: "/api/gemini/generate-message",
        method: "POST",
        data: {
          leadId,
          messageType
        }
      });
      
      if (!response.success) {
        throw new Error("Error generando mensaje");
      }
      
      return response.message;
    } catch (error) {
      console.error("Error en useGemini.generateMessage:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el mensaje. La API de Gemini puede estar configurada incorrectamente.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Analiza un lead utilizando la API de Gemini
   * @param leadId ID del lead a analizar
   * @returns Análisis detallado del lead
   */
  const analyzeLead = async (leadId: number): Promise<string> => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest<AnalyzeLeadResponse>({
        url: "/api/gemini/analyze-lead",
        method: "POST",
        data: { leadId }
      });
      
      if (!response.success) {
        throw new Error("Error analizando lead");
      }
      
      return response.analysis;
    } catch (error) {
      console.error("Error en useGemini.analyzeLead:", error);
      toast({
        title: "Error",
        description: "No se pudo analizar el lead. La API de Gemini puede estar configurada incorrectamente.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Obtiene una sugerencia de acción para un lead específico
   * @param leadId ID del lead para obtener sugerencias
   * @returns Objeto con la acción sugerida
   */
  const suggestAction = async (leadId: number) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest({
        url: "/api/gemini/suggest-action",
        method: "POST",
        data: { leadId }
      });
      
      return response;
    } catch (error) {
      console.error("Error en useGemini.suggestAction:", error);
      toast({
        title: "Error",
        description: "No se pudo obtener sugerencias para el lead.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    generateMessage,
    analyzeLead,
    suggestAction,
    isLoading
  };
}