import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Smartphone, Wifi, WifiOff, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Datos fijos mientras solucionamos las APIs
const mockAccounts = [
  {
    id: 1,
    name: "prueba",
    description: "pruebeaaa",
    ownerName: "Misael Moreno Frias",
    ownerPhone: "15517270417",
    status: "pending_auth",
    createdAt: "2025-05-27T06:08:07.793Z"
  },
  {
    id: 10,
    name: "Mi Cuenta WhatsApp",
    description: "Cuenta principal para mensajes",
    ownerName: "",
    ownerPhone: "",
    status: "disconnected",
    createdAt: "2025-05-29T02:40:45.352Z"
  }
];

export default function WhatsAppAccountsFixed() {
  const [accounts] = useState(mockAccounts);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDescription, setNewAccountDescription] = useState("");
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'pending_auth':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      default:
        return <WifiOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'pending_auth':
        return 'bg-yellow-100 text-yellow-800';
      case 'disconnected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Conectado';
      case 'pending_auth':
        return 'Esperando autenticación';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Desconocido';
    }
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la cuenta es requerido",
        variant: "destructive",
      });
      return;
    }

    try {
      // Por ahora solo mostramos el mensaje, las APIs no funcionan
      toast({
        title: "Información",
        description: "Las APIs están siendo reparadas. Tu cuenta se creará pronto.",
      });
      
      setIsCreateDialogOpen(false);
      setNewAccountName("");
      setNewAccountDescription("");
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear la cuenta. Intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleConnect = (accountId: number) => {
    toast({
      title: "Información",
      description: "Funcionalidad de conexión en desarrollo. Las APIs están siendo reparadas.",
    });
  };

  const handleDisconnect = (accountId: number) => {
    toast({
      title: "Información", 
      description: "Funcionalidad de desconexión en desarrollo. Las APIs están siendo reparadas.",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Cuentas de WhatsApp</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tus cuentas de WhatsApp Business para mensajería empresarial
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nueva Cuenta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Cuenta de WhatsApp</DialogTitle>
              <DialogDescription>
                Agrega una nueva cuenta de WhatsApp Business para gestionar tus conversaciones
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre de la cuenta</Label>
                <Input
                  id="name"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Ej: Soporte al Cliente"
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Textarea
                  id="description"
                  value={newAccountDescription}
                  onChange={(e) => setNewAccountDescription(e.target.value)}
                  placeholder="Describe el propósito de esta cuenta..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateAccount}>
                  Crear Cuenta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {accounts.map((account) => (
          <Card key={account.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">{account.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {getStatusIcon(account.status)}
                </div>
              </div>
              <Badge className={getStatusColor(account.status)}>
                {getStatusText(account.status)}
              </Badge>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {account.description && (
                <CardDescription className="text-sm">
                  {account.description}
                </CardDescription>
              )}
              
              {account.ownerName && (
                <div className="text-sm">
                  <span className="font-medium">Propietario:</span> {account.ownerName}
                </div>
              )}
              
              {account.ownerPhone && (
                <div className="text-sm">
                  <span className="font-medium">Teléfono:</span> {account.ownerPhone}
                </div>
              )}
              
              <div className="text-xs text-gray-500">
                Creado: {new Date(account.createdAt).toLocaleDateString()}
              </div>
              
              <div className="flex gap-2 pt-2">
                {account.status === 'disconnected' || account.status === 'pending_auth' ? (
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleConnect(account.id)}
                  >
                    <Wifi className="h-4 w-4 mr-1" />
                    Conectar
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    variant="destructive"
                    className="flex-1"
                    onClick={() => handleDisconnect(account.id)}
                  >
                    <WifiOff className="h-4 w-4 mr-1" />
                    Desconectar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <div className="text-center py-12">
          <Smartphone className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No hay cuentas de WhatsApp
          </h3>
          <p className="text-gray-600 mb-4">
            Comienza creando tu primera cuenta de WhatsApp Business
          </p>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primera Cuenta
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}
    </div>
  );
}