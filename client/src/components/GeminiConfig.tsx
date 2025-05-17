import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { chatContext, type ChatConfig } from '@/lib/chatContext';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GeminiConfigProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GeminiConfig({ chatId, isOpen, onClose }: GeminiConfigProps) {
  const [config, setConfig] = useState<ChatConfig>({
    customPrompt: '',
    systemRole: 'asistente',
    temperature: 0.7,
    modelName: 'gemini-1.5-pro',
    provider: 'gemini' // Proveedor por defecto
  });
  
  // Cargar la configuración actual cuando se abre el diálogo
  useEffect(() => {
    if (isOpen && chatId) {
      const currentConfig = chatContext.getConversation(chatId).config;
      setConfig(currentConfig);
    }
  }, [isOpen, chatId]);
  
  // Manejar cambios en el formulario
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig(prev => ({
      ...prev,
      customPrompt: e.target.value
    }));
  };
  
  // Guardar la configuración
  const handleSave = () => {
    if (chatId) {
      chatContext.updateConfig(chatId, config);
      onClose();
    }
  };
  
  // Borrar historial de conversación
  const handleClearHistory = () => {
    if (chatId && window.confirm('¿Estás seguro de que deseas borrar todo el historial de esta conversación?')) {
      chatContext.clearHistory(chatId);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Configuración de Gemini AI</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-1">
              Prompt personalizado
            </label>
            <textarea
              id="prompt"
              value={config.customPrompt || ''}
              onChange={handlePromptChange}
              placeholder="Eres un asistente de atención al cliente profesional y útil..."
              className="w-full h-32 px-3 py-2 border rounded-md"
            />
          </div>

          <div className="mt-4">
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer font-medium">Ejemplos de prompts</summary>
              <div className="mt-2 space-y-2 p-2 bg-gray-50 rounded-md">
                <div>
                  <h4 className="font-medium">Atención al cliente:</h4>
                  <p className="text-xs">Eres un asistente de atención al cliente profesional. Tu trabajo es responder a las consultas de manera concisa, empatizar con el cliente, ofrecer soluciones eficaces, y seguir las políticas de la empresa.</p>
                </div>
                <div>
                  <h4 className="font-medium">Ventas:</h4>
                  <p className="text-xs">Eres un vendedor experto. Tu objetivo es entender las necesidades del cliente, destacar las características y beneficios de nuestros productos, manejar objeciones y cerrar ventas de manera efectiva.</p>
                </div>
                <div>
                  <h4 className="font-medium">Soporte técnico:</h4>
                  <p className="text-xs">Eres un especialista de soporte técnico. Tu función es diagnosticar problemas técnicos, proporcionar soluciones paso a paso, y explicar conceptos técnicos de manera sencilla para el usuario.</p>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4">
          <div>
            <Button 
              variant="outline" 
              onClick={handleClearHistory}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Borrar historial
            </Button>
          </div>
          <div>
            <Button variant="outline" onClick={onClose} className="mr-2">
              Cancelar
            </Button>
            <Button onClick={handleSave}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}