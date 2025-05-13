import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Message } from "@shared/schema";

export function useGemini() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /**
   * Analyze a lead with Gemini AI to enrich data and generate insights
   */
  const analyzeLeadWithGemini = async (leadId: number) => {
    try {
      setIsAnalyzing(true);
      const response = await apiRequest("POST", "/api/gemini/analyze-lead", { leadId });
      const data = await response.json();
      
      // Invalidate lead queries to refresh with the new AI-enriched data
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] });
      
      return data;
    } catch (error) {
      console.error("Error analyzing lead with Gemini:", error);
      throw error;
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Generate a message template based on lead information
   */
  const generateMessage = async (leadId: number, messageType: string, context?: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/gemini/generate-message", { 
        leadId, 
        messageType,
        context 
      });
      const data = await response.json();
      return data.content;
    } catch (error) {
      console.error("Error generating message with Gemini:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send a message to the Gemini AI assistant and get a response
   */
  const sendChatMessage = async (message: string, history: Message[]) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/gemini/chat", { 
        message,
        history
      });
      return await response.json();
    } catch (error) {
      console.error("Error chatting with Gemini:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    analyzeLeadWithGemini,
    generateMessage,
    sendChatMessage,
    isLoading,
    isAnalyzing
  };
}
