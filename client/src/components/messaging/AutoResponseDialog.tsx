import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Bot, Clock, Hash, MessageSquare, Zap } from 'lucide-react';

// Schema for auto-response configuration
const autoResponseSchema = z.object({
  enabled: z.boolean(),
  template: z.string().min(1, 'Template message is required'),
  triggerKeywords: z.array(z.string()).min(1, 'At least one trigger keyword is required'),
  schedule: z.object({
    enabled: z.boolean(),
    startTime: z.string(),
    endTime: z.string(),
    timezone: z.string(),
  }),
  maxResponsesPerDay: z.number().min(1).max(100).optional(),
});

interface AutoResponseConfig {
  enabled: boolean;
  template: string;
  triggerKeywords: string[];
  schedule: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  maxResponsesPerDay?: number;
}

interface AutoResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config?: AutoResponseConfig;
  chatId: string;
  accountId: number;
}

export function AutoResponseDialog({
  open,
  onOpenChange,
  config,
  chatId,
  accountId,
}: AutoResponseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [keywordInput, setKeywordInput] = useState('');

  // Form setup
  const form = useForm<z.infer<typeof autoResponseSchema>>({
    resolver: zodResolver(autoResponseSchema),
    defaultValues: {
      enabled: config?.enabled || false,
      template: config?.template || '',
      triggerKeywords: config?.triggerKeywords || [],
      schedule: {
        enabled: config?.schedule?.enabled || false,
        startTime: config?.schedule?.startTime || '09:00',
        endTime: config?.schedule?.endTime || '17:00',
        timezone: config?.schedule?.timezone || 'America/Mexico_City',
      },
      maxResponsesPerDay: config?.maxResponsesPerDay || 10,
    },
  });

  // Update form when config changes
  useEffect(() => {
    if (config) {
      form.reset({
        enabled: config.enabled,
        template: config.template,
        triggerKeywords: config.triggerKeywords,
        schedule: config.schedule,
        maxResponsesPerDay: config.maxResponsesPerDay || 10,
      });
    }
  }, [config, form]);

  // Query to fetch current config
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['/api/auto-response/config', chatId, accountId],
    queryFn: async () => {
      const response = await fetch(`/api/auto-response/config/${chatId}/${accountId}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No config exists yet
        }
        throw new Error('Failed to fetch auto-response config');
      }
      return response.json();
    },
    enabled: open && !!chatId && !!accountId,
  });

  // Mutation to save config
  const saveConfigMutation = useMutation({
    mutationFn: async (data: AutoResponseConfig) => {
      const response = await fetch(`/api/auto-response/config/${chatId}/${accountId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          chatId,
          accountId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save auto-response config');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Configuración guardada',
        description: 'Las configuraciones de auto-respuesta se han actualizado exitosamente',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-response/config', chatId, accountId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Error al guardar configuración: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: z.infer<typeof autoResponseSchema>) => {
    const newConfig: AutoResponseConfig = {
      enabled: data.enabled,
      template: data.template,
      triggerKeywords: data.triggerKeywords,
      schedule: data.schedule,
      maxResponsesPerDay: data.maxResponsesPerDay,
    };

    saveConfigMutation.mutate(newConfig);
  };

  // Handle adding keywords
  const addKeyword = () => {
    if (keywordInput.trim()) {
      const currentKeywords = form.getValues('triggerKeywords');
      if (!currentKeywords.includes(keywordInput.trim())) {
        form.setValue('triggerKeywords', [...currentKeywords, keywordInput.trim()]);
        setKeywordInput('');
      }
    }
  };

  // Handle removing keywords
  const removeKeyword = (keyword: string) => {
    const currentKeywords = form.getValues('triggerKeywords');
    form.setValue('triggerKeywords', currentKeywords.filter(k => k !== keyword));
  };

  // Handle keyword input keypress
  const handleKeywordKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const triggerKeywords = form.watch('triggerKeywords') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            Auto-Response Configuration
          </DialogTitle>
          <DialogDescription>
            Configure automatic responses for this chat. Messages will be sent when trigger keywords are detected.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Enable/Disable Toggle */}
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Enable Auto-Response
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Automatically send responses when trigger keywords are detected
                    </div>
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

            {/* Template Message */}
            <FormField
              control={form.control}
              name="template"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Response Template
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter your automatic response message..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Trigger Keywords */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Trigger Keywords
              </FormLabel>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Add keyword..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyPress={handleKeywordKeyPress}
                />
                <Button
                  type="button"
                  onClick={addKeyword}
                  disabled={!keywordInput.trim()}
                >
                  Add
                </Button>
              </div>

              {triggerKeywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {triggerKeywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeKeyword(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule Settings */}
            <FormField
              control={form.control}
              name="schedule.enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Schedule Restrictions
                    </FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Only send responses during specific hours
                    </div>
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

            {form.watch('schedule.enabled') && (
              <div className="grid grid-cols-2 gap-4 pl-4">
                <FormField
                  control={form.control}
                  name="schedule.startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="schedule.endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Max Responses Per Day */}
            <FormField
              control={form.control}
              name="maxResponsesPerDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Responses Per Day</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveConfigMutation.isPending || !form.formState.isValid}
              >
                {saveConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}