import { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

// AI Integration settings schema
const aiIntegrationSchema = z.object({
  selectedProvider: z.enum(["gemini", "openai", "qwen3"]).default("gemini"),
  geminiApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  qwenApiKey: z.string().optional(),
  customPrompt: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.7),
  enableAIResponses: z.boolean().default(true),
});

type AiIntegrationValues = z.infer<typeof aiIntegrationSchema>;

export default function AISettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Cargar configuraciones desde la base de datos
  const { data: aiSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['/api/ai-settings'],
    queryFn: async () => {
      const response = await fetch('/api/ai-settings');
      if (!response.ok) {
        throw new Error('Error al cargar configuraciones');
      }
      return response.json();
    }
  });
  
  // AI Integration form setup
  const aiForm = useForm<AiIntegrationValues>({
    resolver: zodResolver(aiIntegrationSchema),
    defaultValues: {
      selectedProvider: "gemini",
      geminiApiKey: "",
      openaiApiKey: "",
      qwenApiKey: "",
      customPrompt: "Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.",
      temperature: 0.7,
      enableAIResponses: true,
    },
  });

  // Actualizar formulario cuando se cargan las configuraciones
  useEffect(() => {
    if (aiSettings) {
      const hasExistingConfig = aiSettings.selectedProvider || aiSettings.geminiApiKey || aiSettings.openaiApiKey || aiSettings.qwenApiKey;
      
      aiForm.reset({
        selectedProvider: aiSettings.selectedProvider || "gemini",
        geminiApiKey: aiSettings.geminiApiKey || "",
        openaiApiKey: aiSettings.openaiApiKey || "",
        qwenApiKey: aiSettings.qwenApiKey || "",
        customPrompt: aiSettings.customPrompt || "Eres un asistente virtual útil y amigable. Responde de manera profesional y concisa.",
        temperature: aiSettings.temperature || 0.7,
        enableAIResponses: aiSettings.enableAIResponses || false,
      });

      // Mostrar mensaje de bienvenida solo si hay configuraciones existentes
      if (hasExistingConfig) {
        toast({
          title: "📋 Configuraciones cargadas",
          description: `Proveedor actual: ${(aiSettings.selectedProvider || "gemini").toUpperCase()}`,
          duration: 2000,
        });
      }
    }
  }, [aiSettings, aiForm, toast]);

  // Mutación para guardar configuraciones
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: AiIntegrationValues) => {
      const response = await fetch('/api/ai-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al guardar configuraciones');
      }
      
      return response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-settings'] });
      
      // Mostrar mensaje específico según si se creó o actualizó
      const isNewConfiguration = response.message?.includes('creadas');
      
      toast({
        title: isNewConfiguration ? "🎉 Configuración creada" : "✅ Configuración actualizada",
        description: response.message || "Las configuraciones de AI han sido guardadas exitosamente.",
        duration: 4000,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error al guardar",
        description: error.message || "No se pudo guardar la configuración. Inténtalo de nuevo.",
        variant: "destructive",
        duration: 5000,
      });
    }
  });

  // AI Integration form submission handler
  const onAiIntegrationSubmit = (values: AiIntegrationValues) => {
    saveSettingsMutation.mutate(values);
  };

  return (
    <>
      <Helmet>
        <title>AI Integration Settings | GeminiCRM</title>
        <meta name="description" content="Configure AI providers for intelligent WhatsApp responses" />
      </Helmet>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">AI Integration</h1>
        <p className="text-sm text-gray-500">
          Configure your AI provider and settings for intelligent WhatsApp responses
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Integration</CardTitle>
          <CardDescription>
            Configure your AI provider and settings for intelligent WhatsApp responses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...aiForm}>
            <form onSubmit={aiForm.handleSubmit(onAiIntegrationSubmit)} className="space-y-6">
              <div className="space-y-6">
                {/* AI Provider Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">AI Provider Selection</h3>
                  <FormField
                    control={aiForm.control}
                    name="selectedProvider"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Choose your AI provider</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select AI provider" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gemini">🤖 Google Gemini AI</SelectItem>
                              <SelectItem value="openai">🧠 OpenAI GPT</SelectItem>
                              <SelectItem value="qwen3">🚀 Qwen3 AI</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>
                          Select the AI provider for generating intelligent WhatsApp responses
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* API Keys Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">API Keys</h3>
                  
                  {/* Gemini API Key */}
                  <FormField
                    control={aiForm.control}
                    name="geminiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gemini API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your Gemini API key"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Get your API key from{" "}
                          <a
                            href="https://aistudio.google.com/app/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Google AI Studio
                          </a>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* OpenAI API Key */}
                  <FormField
                    control={aiForm.control}
                    name="openaiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>OpenAI API Key</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your OpenAI API key"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Get your API key from{" "}
                          <a
                            href="https://platform.openai.com/api-keys"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            OpenAI Platform
                          </a>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Qwen3 API Key */}
                  <FormField
                    control={aiForm.control}
                    name="qwenApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Qwen3 API Key (DashScope)</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Enter your DashScope API key"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Get your API key from{" "}
                          <a
                            href="https://dashscope.aliyun.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            Alibaba Cloud DashScope
                          </a>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* AI Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">AI Configuration</h3>
                  
                  <FormField
                    control={aiForm.control}
                    name="enableAIResponses"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable AI Responses</FormLabel>
                          <FormDescription>
                            Turn on AI-powered automatic responses for WhatsApp messages
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={aiForm.control}
                    name="temperature"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Response Creativity (Temperature: {field.value})</FormLabel>
                        <FormControl>
                          <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </FormControl>
                        <FormDescription>
                          Lower values (0.1-0.3) for focused responses, higher values (0.7-1.0) for creative responses
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={aiForm.control}
                    name="customPrompt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom System Prompt</FormLabel>
                        <FormControl>
                          <textarea
                            placeholder="Enter custom instructions for the AI (optional)"
                            className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Customize how the AI responds to your customers. Leave empty for default behavior.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <CardFooter className="px-0">
                <Button 
                  type="submit" 
                  disabled={saveSettingsMutation.isPending || isLoadingSettings}
                >
                  {saveSettingsMutation.isPending ? "Guardando..." : "Guardar Configuraciones de AI"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}