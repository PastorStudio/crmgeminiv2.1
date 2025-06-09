import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Save, DollarSign, Calendar, Users, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface PlanFormData {
  name: string;
  description: string;
  price: string;
  currency: string;
  durationDays: number;
  maxUsers: number;
  maxWhatsAppAccounts: number;
  maxChatsPerMonth: number;
  features: string[];
  isActive: boolean;
}

const SubscriptionPlanCreator: React.FC<{ onPlanCreated?: () => void }> = ({ onPlanCreated }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: '',
    currency: 'USD',
    durationDays: 30,
    maxUsers: 1,
    maxWhatsAppAccounts: 1,
    maxChatsPerMonth: 1000,
    features: [],
    isActive: true
  });

  const [featureInput, setFeatureInput] = useState('');

  const handleInputChange = (field: keyof PlanFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, featureInput.trim()]
      }));
      setFeatureInput('');
    }
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      toast({
        title: "Error",
        description: "Nombre y precio son requeridos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Direct fetch to bypass apiRequest middleware issues
      const response = await fetch('/api/subscription-plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          price: parseFloat(formData.price),
          currency: formData.currency,
          durationDays: formData.durationDays,
          maxUsers: formData.maxUsers,
          maxWhatsAppAccounts: formData.maxWhatsAppAccounts,
          maxChatsPerMonth: formData.maxChatsPerMonth,
          features: formData.features,
          isActive: formData.isActive
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const responseData = await response.json();

      if (responseData.success) {
        toast({
          title: "Plan creado",
          description: responseData.message || "Plan de suscripción creado correctamente",
        });
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          price: '',
          currency: 'USD',
          durationDays: 30,
          maxUsers: 1,
          maxWhatsAppAccounts: 1,
          maxChatsPerMonth: 1000,
          features: [],
          isActive: true
        });
        setFeatureInput('');
        setIsOpen(false);
        
        // Invalidate React Query cache for subscription plans
        await queryClient.invalidateQueries({ queryKey: ['/api/subscription-plans'] });
        
        if (onPlanCreated) {
          onPlanCreated();
        }
      } else {
        throw new Error(responseData.message || "Error al crear el plan");
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el plan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const predefinedPlans = [
    {
      name: 'Plan Básico',
      description: 'Perfecto para pequeños negocios',
      price: '29.99',
      durationDays: 30,
      maxUsers: 3,
      maxWhatsAppAccounts: 2,
      maxChatsPerMonth: 1000,
      features: ['Respuestas automáticas', 'Gestión de contactos', 'Análisis básico']
    },
    {
      name: 'Plan Pro',
      description: 'Para empresas en crecimiento',
      price: '79.99',
      durationDays: 30,
      maxUsers: 10,
      maxWhatsAppAccounts: 5,
      maxChatsPerMonth: 5000,
      features: ['Todo lo del Plan Básico', 'IA avanzada', 'Reportes detallados', 'Integraciones']
    },
    {
      name: 'Plan Enterprise',
      description: 'Para grandes organizaciones',
      price: '199.99',
      durationDays: 30,
      maxUsers: 50,
      maxWhatsAppAccounts: 20,
      maxChatsPerMonth: 20000,
      features: ['Todo lo del Plan Pro', 'Soporte 24/7', 'API personalizada', 'Configuración dedicada']
    }
  ];

  const loadPredefinedPlan = (plan: any) => {
    setFormData({
      ...formData,
      ...plan,
      currency: 'USD',
      isActive: true
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Crear Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Plan de Suscripción</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Predefined Plans */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Plantillas Predefinidas
            </Label>
            <div className="grid gap-2 grid-cols-1 md:grid-cols-3">
              {predefinedPlans.map((plan, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => loadPredefinedPlan(plan)}
                  className="text-left h-auto p-3"
                >
                  <div>
                    <p className="font-semibold text-xs">{plan.name}</p>
                    <p className="text-xs text-gray-500">${plan.price}/mes</p>
                  </div>
                </Button>
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Nombre del Plan</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="ej: Plan Básico"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Precio
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="29.99"
                  className="flex-1"
                />
                <Input
                  value={formData.currency}
                  onChange={(e) => handleInputChange('currency', e.target.value)}
                  placeholder="USD"
                  className="w-20"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700">Descripción</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción del plan..."
              rows={3}
            />
          </div>

          {/* Limits */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div>
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Duración (días)
              </Label>
              <Input
                type="number"
                value={formData.durationDays}
                onChange={(e) => handleInputChange('durationDays', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Max. Usuarios
              </Label>
              <Input
                type="number"
                value={formData.maxUsers}
                onChange={(e) => handleInputChange('maxUsers', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700">Max. Cuentas WA</Label>
              <Input
                type="number"
                value={formData.maxWhatsAppAccounts}
                onChange={(e) => handleInputChange('maxWhatsAppAccounts', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Max. Chats/mes
              </Label>
              <Input
                type="number"
                value={formData.maxChatsPerMonth}
                onChange={(e) => handleInputChange('maxChatsPerMonth', parseInt(e.target.value))}
              />
            </div>
          </div>

          {/* Features */}
          <div>
            <Label className="text-sm font-medium text-gray-700">Características</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                placeholder="Agregar característica..."
                onKeyPress={(e) => e.key === 'Enter' && addFeature()}
              />
              <Button type="button" onClick={addFeature} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  {feature}
                  <button
                    onClick={() => removeFeature(index)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Switch */}
          <div className="flex items-center gap-3">
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => handleInputChange('isActive', checked)}
            />
            <Label className="text-sm font-medium text-gray-700">Plan activo</Label>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="flex-1 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Creando...' : 'Crear Plan'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)} 
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionPlanCreator;