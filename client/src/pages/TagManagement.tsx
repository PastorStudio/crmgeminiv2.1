import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Edit3, Plus, Tag, Palette, Users, MessageCircle, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Tag {
  id: number;
  name: string;
  color: string;
  description?: string;
  category: string;
  isSystem: boolean;
  userId?: number;
  createdAt: string;
  updatedAt: string;
}

const predefinedColors = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

const categories = [
  { value: "general", label: "General", icon: Tag },
  { value: "priority", label: "Prioridad", icon: Users },
  { value: "status", label: "Estado", icon: MessageCircle },
  { value: "custom", label: "Personalizado", icon: Ticket }
];

export default function TagManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    color: "#3B82F6",
    description: "",
    category: "general"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Obtener todas las etiquetas
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["/api/tags"],
    refetchInterval: 5000
  });

  // Mutación para crear etiqueta
  const createTagMutation = useMutation({
    mutationFn: async (tagData: any) => {
      return await apiRequest("/api/tags", {
        method: "POST",
        body: JSON.stringify(tagData),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Etiqueta creada",
        description: data?.message || "La etiqueta se ha creado correctamente",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "No se pudo crear la etiqueta";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para actualizar etiqueta
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, ...tagData }: any) => {
      return await apiRequest(`/api/tags/${id}`, {
        method: "PUT",
        body: JSON.stringify(tagData),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsEditDialogOpen(false);
      setEditingTag(null);
      resetForm();
      toast({
        title: "Etiqueta actualizada",
        description: data?.message || "La etiqueta se ha actualizado correctamente",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "No se pudo actualizar la etiqueta";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para eliminar etiqueta
  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: number) => {
      return await apiRequest(`/api/tags/${tagId}`, {
        method: "DELETE"
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Etiqueta eliminada",
        description: data?.message || "La etiqueta se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "No se pudo eliminar la etiqueta";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  // Mutación para inicializar etiquetas del sistema
  const initializeSystemTagsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/tags/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Etiquetas inicializadas",
        description: data?.message || "Las etiquetas del sistema se han inicializado correctamente",
      });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "No se pudieron inicializar las etiquetas del sistema";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: "",
      color: "#3B82F6",
      description: "",
      category: "general"
    });
  };

  const handleCreateTag = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la etiqueta es obligatorio",
        variant: "destructive",
      });
      return;
    }

    createTagMutation.mutate(formData);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color,
      description: tag.description || "",
      category: tag.category
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateTag = () => {
    if (!editingTag || !formData.name.trim()) return;

    updateTagMutation.mutate({
      id: editingTag.id,
      ...formData
    });
  };

  const handleDeleteTag = (tag: Tag) => {
    if (tag.isSystem) {
      toast({
        title: "Error",
        description: "No se pueden eliminar etiquetas del sistema",
        variant: "destructive",
      });
      return;
    }

    if (window.confirm(`¿Estás seguro de eliminar la etiqueta "${tag.name}"?`)) {
      deleteTagMutation.mutate(tag.id);
    }
  };

  const groupedTags = tags.reduce((groups: any, tag: Tag) => {
    const category = tag.category || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(tag);
    return groups;
  }, {});

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Etiquetas</h1>
          <p className="text-gray-600 mt-2">
            Crea y gestiona etiquetas para organizar leads, contactos, mensajes y tickets
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => initializeSystemTagsMutation.mutate()}
            disabled={initializeSystemTagsMutation.isPending}
          >
            {initializeSystemTagsMutation.isPending ? "Inicializando..." : "Inicializar Sistema"}
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Etiqueta
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Etiqueta</DialogTitle>
              <DialogDescription>
                Las etiquetas te ayudan a organizar y categorizar tus contactos
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre de la etiqueta"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        <div className="flex items-center">
                          <category.icon className="h-4 w-4 mr-2" />
                          {category.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {predefinedColors.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? 'border-black' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción de la etiqueta"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateTag} disabled={createTagMutation.isPending}>
                {createTagMutation.isPending ? "Creando..." : "Crear Etiqueta"}
              </Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Tag className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Etiquetas</p>
                <p className="text-2xl font-bold">{tags.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Prioridad</p>
                <p className="text-2xl font-bold">{groupedTags.priority?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <MessageCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Estado</p>
                <p className="text-2xl font-bold">{groupedTags.status?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Palette className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Personalizado</p>
                <p className="text-2xl font-bold">{groupedTags.custom?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de etiquetas por categoría */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((categoryInfo) => {
            const categoryTags = groupedTags[categoryInfo.value] || [];
            if (categoryTags.length === 0) return null;

            return (
              <Card key={categoryInfo.value}>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <categoryInfo.icon className="h-5 w-5 mr-2" />
                    {categoryInfo.label}
                    <Badge variant="secondary" className="ml-2">
                      {categoryTags.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Etiquetas de {categoryInfo.label.toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryTags.map((tag: Tag) => (
                      <div
                        key={tag.id}
                        className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            style={{ backgroundColor: tag.color, color: 'white' }}
                            className="text-white"
                          >
                            {tag.name}
                          </Badge>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditTag(tag)}
                              disabled={tag.isSystem}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTag(tag)}
                              disabled={tag.isSystem}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {tag.description && (
                          <p className="text-sm text-gray-600">{tag.description}</p>
                        )}
                        {tag.isSystem && (
                          <Badge variant="outline" className="mt-2 text-xs">
                            Sistema
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Etiqueta</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la etiqueta
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre de la etiqueta"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-category">Categoría</Label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex items-center">
                        <category.icon className="h-4 w-4 mr-2" />
                        {category.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {predefinedColors.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      formData.color === color ? 'border-black' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormData({ ...formData, color })}
                  />
                ))}
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción (opcional)</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la etiqueta"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateTag} disabled={updateTagMutation.isPending}>
              {updateTagMutation.isPending ? "Actualizando..." : "Actualizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}