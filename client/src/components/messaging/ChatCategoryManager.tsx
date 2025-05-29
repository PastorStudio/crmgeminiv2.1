import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Tag, Palette, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface ChatCategoryManagerProps {
  chatId: string;
  accountId: number;
  currentCategoryId?: number;
  onCategoryChange?: (categoryId: number) => void;
}

// Colores predefinidos para las categorías
const PRESET_COLORS = [
  '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export const ChatCategoryManager: React.FC<ChatCategoryManagerProps> = ({
  chatId,
  accountId,
  currentCategoryId,
  onCategoryChange
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Cargar categorías disponibles
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/chat-categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  // Crear nueva categoría
  const createCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({
        title: "Error",
        description: "El nombre de la categoría es obligatorio",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/chat-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDescription,
          color: newCategoryColor,
          icon: 'Tag',
          accountId: accountId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCategories([...categories, data.category]);
          setNewCategoryName('');
          setNewCategoryDescription('');
          setNewCategoryColor('#3B82F6');
          setShowCreateDialog(false);
          
          toast({
            title: "Éxito",
            description: "Categoría creada correctamente"
          });
        }
      }
    } catch (error) {
      console.error('Error creando categoría:', error);
      toast({
        title: "Error",
        description: "No se pudo crear la categoría",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Asignar chat a categoría
  const assignToCategory = async (categoryId: number) => {
    setLoading(true);
    try {
      const response = await fetch('/api/chat-categories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          accountId,
          categoryId
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setShowCategoryDialog(false);
          onCategoryChange?.(categoryId);
          
          const category = categories.find(c => c.id === categoryId);
          toast({
            title: "Éxito",
            description: `Chat asignado a la categoría "${category?.name}"`
          });
        }
      }
    } catch (error) {
      console.error('Error asignando categoría:', error);
      toast({
        title: "Error",
        description: "No se pudo asignar la categoría",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botón para cambiar categoría del chat */}
      <Button
        size="sm"
        variant="outline"
        className="border-purple-600 text-purple-600 hover:bg-purple-50"
        onClick={() => setShowCategoryDialog(true)}
      >
        <Tag className="h-4 w-4 mr-1" />
        Categoría
      </Button>

      {/* Dialog para seleccionar/cambiar categoría */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar Categoría</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Categorías disponibles:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nueva
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant={currentCategoryId === category.id ? "default" : "outline"}
                  className="justify-start"
                  style={{
                    backgroundColor: currentCategoryId === category.id ? category.color : 'transparent',
                    borderColor: category.color,
                    color: currentCategoryId === category.id ? 'white' : category.color
                  }}
                  onClick={() => assignToCategory(category.id)}
                  disabled={loading}
                >
                  <Tag className="h-4 w-4 mr-2" />
                  {category.name}
                  {currentCategoryId === category.id && (
                    <Check className="h-4 w-4 ml-auto" />
                  )}
                </Button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para crear nueva categoría */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Crear Nueva Categoría</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Nombre de la categoría</Label>
              <Input
                id="categoryName"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej: Ventas, Soporte, Consultas..."
              />
            </div>

            <div>
              <Label htmlFor="categoryDescription">Descripción (opcional)</Label>
              <Input
                id="categoryDescription"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                placeholder="Descripción de la categoría..."
              />
            </div>

            <div>
              <Label>Color de la categoría</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newCategoryColor === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryColor(color)}
                  />
                ))}
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <Palette className="h-4 w-4" />
                <input
                  type="color"
                  value={newCategoryColor}
                  onChange={(e) => setNewCategoryColor(e.target.value)}
                  className="w-12 h-8 border rounded cursor-pointer"
                />
                <span className="text-sm text-gray-500">{newCategoryColor}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={createCategory} disabled={loading}>
              {loading ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};