import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SuperSimpleToggle from "@/components/messaging/SuperSimpleToggle";

// Template schema
const templateSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "El nombre es obligatorio"),
  pattern: z.string().optional(),
  template: z.string().min(1, "La plantilla es obligatoria"),
  autoDetect: z.boolean().default(false),
});

// Configuration schema
const autoResponseConfigSchema = z.object({
  enabled: z.boolean().default(false),
  delaySeconds: z.number().min(1).max(60),
  templates: z.array(templateSchema),
  useProfessionLevel: z.boolean().default(true),
  defaultTemplate: z.string(),
  enabledForGroups: z.boolean().default(false),
  enabledForBroadcast: z.boolean().default(false),
  excludedContacts: z.array(z.string()),
  aiProvider: z.enum(["gemini", "openai", "smartbots"]),
  customPrompts: z.object({
    enabled: z.boolean().default(false),
    system: z.string(),
    temperature: z.number().min(0).max(1),
    maxTokens: z.number().min(100).max(2000),
  }),
});

type AutoResponseConfig = z.infer<typeof autoResponseConfigSchema>;
type Template = z.infer<typeof templateSchema>;

export default function AutoResponseSettings() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testAnalysis, setTestAnalysis] = useState<any>(null);
  const [testingSmartBots, setTestingSmartBots] = useState(false);
  
  // Fetch configuration
  const { data: config, isLoading: configLoading, isError } = useQuery({
    queryKey: ["/api/auto-response/config"],
    queryFn: async () => {
      const response = await fetch("/api/auto-response/config");
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log('Configuración recibida:', data);
      return data;
    },
    retry: 2,
    retryDelay: 1000,
  });
  
  // Setup form
  const form = useForm<AutoResponseConfig>({
    resolver: zodResolver(autoResponseConfigSchema),
    defaultValues: {
      enabled: false,
      delaySeconds: 10,
      templates: [],
      useProfessionLevel: true,
      defaultTemplate: "",
      enabledForGroups: false,
      enabledForBroadcast: false,
      excludedContacts: [],
      aiProvider: "smartbots",
      customPrompts: {
        enabled: false,
        system: "",
        temperature: 0.7,
        maxTokens: 500,
      },
    },
  });
  
  // Update form values when config is loaded or use defaults
  useEffect(() => {
    // Configuración por defecto funcional
    const defaultConfig = {
      enabled: false,
      delaySeconds: 10,
      templates: [
        {
          id: "1",
          name: "Saludo automático",
          content: "¡Hola! Gracias por contactarnos. Te atenderemos pronto.",
          variables: []
        }
      ],
      useProfessionLevel: true,
      defaultTemplate: "1",
      enabledForGroups: false,
      enabledForBroadcast: false,
      excludedContacts: [],
      aiProvider: "smartbots" as const, // Usar SmartBots por defecto
      customPrompts: {
        enabled: true,
        system: "Eres SmartBots, un asistente virtual especializado en atención al cliente para WhatsApp. Responde de manera amable, profesional y útil.",
        temperature: 0.7,
        maxTokens: 500,
      },
    };

    let formConfig = defaultConfig;

    if (config && !isError) {
      console.log('✅ Configuración del servidor cargada:', config);
      // Mapear la configuración del servidor al formato del formulario
      formConfig = {
        enabled: config.enabled || false,
        delaySeconds: config.delaySeconds || config.delay || 10,
        templates: config.templates || defaultConfig.templates,
        useProfessionLevel: true,
        defaultTemplate: config.defaultTemplate || "1",
        enabledForGroups: config.enabledForGroups || false,
        enabledForBroadcast: config.enabledForBroadcast || false,
        excludedContacts: config.excludedContacts || config.excludedNumbers || [],
        aiProvider: (config.provider === "smartbots" || config.useSmartBots) ? "smartbots" : 
                   config.provider === "openai" ? "openai" : 
                   config.provider || "gemini",
        customPrompts: {
          enabled: config.customPrompts?.enabled !== false,
          system: config.customPrompts?.system || config.messageTemplate || defaultConfig.customPrompts.system,
          temperature: config.customPrompts?.temperature || 0.7,
          maxTokens: config.customPrompts?.maxTokens || 500,
        },
      };
    } else {
      console.log('⚠️ Usando configuración por defecto (SmartBots)');
    }

    form.reset(formConfig);
  }, [config, form, isError]);
  
  // Auto-save mutation (sin mostrar toast para cada guardado)
  const { mutate: autoSaveConfig, isPending: isAutoSaving } = useMutation({
    mutationFn: async (values: AutoResponseConfig) => {
      const response = await fetch("/api/config/auto-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config/auto-response"] });
      // Solo mostrar un toast discreto ocasionalmente
      if (Math.random() < 0.1) { // 10% de probabilidad
        toast({
          title: "💾 Guardado automático",
          description: "Configuración actualizada automáticamente",
          duration: 2000,
        });
      }
    },
    onError: (error) => {
      toast({
        title: "⚠️ Error en guardado automático",
        description: `No se pudo guardar automáticamente: ${error.message}`,
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Función de autoguardado con debounce
  const scheduleAutoSave = (values: AutoResponseConfig) => {
    // Solo guardar si ya se ha cargado la configuración inicial
    if (!hasLoadedRef.current) return;
    
    // Cancelar guardado previo si existe
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Programar nuevo guardado en 1.5 segundos
    saveTimeoutRef.current = setTimeout(() => {
      console.log('💾 Autoguardado activado');
      autoSaveConfig(values);
    }, 1500);
  };
  
  // Form submission handler
  const onSubmit = (values: AutoResponseConfig) => {
    // Asegurarse de que todos los campos requeridos estén presentes
    const completeConfig: AutoResponseConfig = {
      ...values,
      aiProvider: values.aiProvider || "gemini",
      customPrompts: {
        enabled: values.customPrompts?.enabled || false,
        system: values.customPrompts?.system || "",
        temperature: values.customPrompts?.temperature || 0.7,
        maxTokens: values.customPrompts?.maxTokens || 500
      }
    };
    
    console.log("Enviando configuración:", completeConfig);
    updateConfig(completeConfig);
  };
  
  // Check for API keys availability
  const { data: geminiKeyStatus } = useQuery({
    queryKey: ["gemini-key-status"],
    queryFn: async () => {
      const response = await fetch("/api/settings/gemini-key-status");
      return await response.json();
    },
  });
  
  const { data: openaiKeyStatus } = useQuery({
    queryKey: ["openai-key-status"],
    queryFn: async () => {
      try {
        const response = await fetch('/api/settings/openai-key-status');
        const result = await response.json();
        return result;
      } catch (error) {
        console.error("Error checking OpenAI key status:", error);
        return { hasValidKey: false };
      }
    },
  });
  
  if (configLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Cargando configuración...</h1>
      </div>
    );
  }
  
  if (isError) {
    console.error('Error en la carga de configuración:', isError);
    // En lugar de mostrar error, usar configuración por defecto pero permitir que funcione la página
  }
  
  return (
    <>
      <Helmet>
        <title>Configuración de Respuestas Automáticas | GeminiCRM</title>
        <meta name="description" content="Configura las respuestas automáticas del sistema para WhatsApp" />
      </Helmet>
      
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Configuración de Respuestas Automáticas</h1>
        <p className="text-sm text-gray-500">
          Configura cómo responde automáticamente el sistema a los mensajes de WhatsApp
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Respuestas Automáticas</CardTitle>
          <CardDescription>
            Configura el comportamiento de las respuestas automáticas a mensajes de WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Habilitar respuestas automáticas</FormLabel>
                      <FormDescription>
                        Activa o desactiva las respuestas automáticas a mensajes de WhatsApp
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
              
              {form.watch("enabled") && (
                <>
                  <FormField
                    control={form.control}
                    name="delaySeconds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retraso de respuesta (segundos)</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              value={[field.value]}
                              min={1}
                              max={60}
                              step={1}
                              onValueChange={(value) => field.onChange(value[0])}
                            />
                            <div className="flex justify-between">
                              <span className="text-xs">1s</span>
                              <span className="text-sm font-medium">{field.value}s</span>
                              <span className="text-xs">60s</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Tiempo de espera antes de enviar una respuesta automática
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Separator className="my-4" />
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Proveedor de IA</h3>
                    <FormField
                      control={form.control}
                      name="aiProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Selecciona el proveedor de IA para respuestas</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un proveedor de IA" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="smartbots">
                                SmartBots AI (Recomendado) {openaiKeyStatus?.hasValidKey ? "✓" : "⚠️"}
                              </SelectItem>
                              <SelectItem value="openai">
                                OpenAI GPT {openaiKeyStatus?.hasValidKey ? "✓" : "⚠️"}
                              </SelectItem>
                              <SelectItem value="gemini">
                                Gemini AI {geminiKeyStatus?.hasValidKey ? "✓" : "⚠️"}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            {field.value === "smartbots" && !openaiKeyStatus?.hasValidKey && (
                              <span className="text-amber-600">⚠️ API key de OpenAI no configurada. SmartBots requiere OpenAI. Configúrala en Ajustes → AI Integration.</span>
                            )}
                            {field.value === "openai" && !openaiKeyStatus?.hasValidKey && (
                              <span className="text-amber-600">⚠️ API key de OpenAI no configurada. Configúrala en Ajustes → AI Integration.</span>
                            )}
                            {field.value === "gemini" && !geminiKeyStatus?.hasValidKey && (
                              <span className="text-amber-600">⚠️ API key de Gemini no configurada. Configúrala en Ajustes → AI Integration.</span>
                            )}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator className="my-4" />
                    
                    <FormField
                      control={form.control}
                      name="customPrompts.enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Habilitar respuestas con IA</FormLabel>
                            <FormDescription>
                              Usa {
                                form.watch("aiProvider") === "smartbots" ? "SmartBots AI" :
                                form.watch("aiProvider") === "gemini" ? "Gemini AI" : 
                                "OpenAI GPT"
                              } para generar respuestas personalizadas en lugar de plantillas fijas
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
                    
                    {form.watch("customPrompts.enabled") && (
                      <>
                        <FormField
                          control={form.control}
                          name="customPrompts.system"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Instrucciones para la IA</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Eres un asistente virtual profesional que responde consultas..."
                                  className="min-h-32"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Define cómo debe comportarse la IA al responder. Usa {"{{"} + "nombre" + {"}}"}  para referirte al nombre del contacto.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="customPrompts.temperature"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Temperatura ({field.value})</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Slider
                                    value={[field.value]}
                                    min={0}
                                    max={1}
                                    step={0.1}
                                    onValueChange={(value) => field.onChange(value[0])}
                                  />
                                  <div className="flex justify-between">
                                    <span className="text-xs">Preciso</span>
                                    <span className="text-xs">Creativo</span>
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Valores más bajos generan respuestas más consistentes y precisas. Valores más altos permiten más creatividad.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="customPrompts.maxTokens"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Longitud máxima ({field.value})</FormLabel>
                              <FormControl>
                                <div className="space-y-2">
                                  <Slider
                                    value={[field.value]}
                                    min={100}
                                    max={2000}
                                    step={100}
                                    onValueChange={(value) => field.onChange(value[0])}
                                  />
                                  <div className="flex justify-between">
                                    <span className="text-xs">Corto</span>
                                    <span className="text-xs">Largo</span>
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Limita la longitud máxima de las respuestas generadas
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                </>
              )}
              
              <div className="space-y-6">
                <Separator />
                
                {/* Nuevo componente de activación directa */}
                <SuperSimpleToggle />
                
                <div className="flex justify-center">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      {isAutoSaving ? (
                        <>
                          <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-blue-700 font-medium">Guardando automáticamente...</span>
                        </>
                      ) : (
                        <>
                          <div className="h-4 w-4 bg-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </div>
                          <span className="text-green-700 font-medium">✅ Autoguardado activo</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Los cambios se guardan automáticamente
                    </p>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}