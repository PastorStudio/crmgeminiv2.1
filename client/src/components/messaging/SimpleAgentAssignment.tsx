import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { UserCheck } from 'lucide-react';

// Tipo simplificado de props para el diálogo
type SimpleAgentAssignmentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  accountId: number;
};

/**
 * Componente simplificado de diálogo de asignación de chat
 * Esta versión es más robusta para evitar errores de renderizado
 */
const SimpleAgentAssignment = ({ open, onOpenChange, chatId, accountId }: SimpleAgentAssignmentProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Lista simplificada de agentes
  const agentes = [
    { id: 1, nombre: "Agente 1" },
    { id: 2, nombre: "Agente 2" },
    { id: 3, nombre: "Supervisor" },
    { id: 4, nombre: "Admin" }
  ];
  
  // Manejar asignación simulada
  const handleAssign = (agenteId: number) => {
    setLoading(true);
    
    // Simulamos una asignación exitosa después de un breve retraso
    setTimeout(() => {
      console.log(`Asignando chat ${chatId} de la cuenta ${accountId} al agente ID ${agenteId}`);
      
      toast({
        title: "Chat asignado",
        description: `El chat ha sido asignado al agente ${agentes.find(a => a.id === agenteId)?.nombre}`,
      });
      
      setLoading(false);
      onOpenChange(false);
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Asignar chat a un agente</DialogTitle>
          <DialogDescription>
            Seleccione uno de los agentes disponibles para asignar este chat.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <p className="text-sm text-gray-500">
            Chat ID: {chatId}<br/>
            Cuenta: {accountId === 1 ? 'Ventas' : accountId === 2 ? 'Soporte' : `Cuenta ${accountId}`}
          </p>
          
          <div className="grid grid-cols-1 gap-2">
            {agentes.map(agente => (
              <Button
                key={agente.id}
                variant="outline"
                className="justify-start"
                disabled={loading}
                onClick={() => handleAssign(agente.id)}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                {agente.nombre}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleAgentAssignment;