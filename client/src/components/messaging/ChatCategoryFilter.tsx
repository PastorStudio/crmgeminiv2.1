import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  Users, 
  User, 
  TrendingUp, 
  HelpCircle, 
  MessageCircle,
  Filter
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  description?: string;
  color: string;
  icon: string;
  count?: number;
}

interface ChatCategoryFilterProps {
  selectedCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  chats: any[];
}

const iconMap = {
  User,
  Users,
  TrendingUp,
  HelpCircle,
  MessageCircle,
  Filter
};

export function ChatCategoryFilter({ 
  selectedCategory, 
  onCategoryChange, 
  chats 
}: ChatCategoryFilterProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'MessageCircle'
  });

  // Categorías predeterminadas del sistema
  const systemCategories = [
    { 
      id: 'individual', 
      name: 'Individual', 
      color: '#10B981', 
      icon: 'User',
      count: chats.filter(chat => !chat.isGroup).length
    },
    { 
      id: 'groups', 
      name: 'Grupos', 
      color: '#8B5CF6', 
      icon: 'Users',
      count: chats.filter(chat => chat.isGroup).length
    },
  ];

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/chat-categories');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      }
    } catch (error) {
      console.error('Error cargando categorías:', error);
    }
  };

  const createCategory = async () => {
    try {
      const response = await fetch('/api/chat-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCategories([...categories, data.category]);
          setNewCategory({ name: '', description: '', color: '#3B82F6', icon: 'MessageCircle' });
          setIsCreateDialogOpen(false);
        }
      }
    } catch (error) {
      console.error('Error creando categoría:', error);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const allCategories = [...systemCategories, ...categories];

  return (
    <div className="border-b border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Categorías</h3>
        
        {/* Botón para crear nueva categoría */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50">
              <Plus className="h-4 w-4 mr-1" />
              Nueva
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nueva Categoría</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  placeholder="Ej: Ventas VIP"
                />
              </div>
              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="Descripción opcional..."
                />
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="color"
                      type="color"
                      value={newCategory.color}
                      onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                      className="w-16 h-8"
                    />
                    <span className="text-sm text-gray-500">{newCategory.color}</span>
                  </div>
                </div>
                <div className="flex-1">
                  <Label htmlFor="icon">Icono</Label>
                  <select
                    id="icon"
                    value={newCategory.icon}
                    onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="MessageCircle">Mensaje</option>
                    <option value="TrendingUp">Ventas</option>
                    <option value="HelpCircle">Soporte</option>
                    <option value="User">Usuario</option>
                    <option value="Users">Usuarios</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={createCategory} disabled={!newCategory.name.trim()}>
                  Crear Categoría
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de categorías */}
      <div className="flex flex-wrap gap-2">
        {/* Opción "Todos" */}
        <Button
          size="sm"
          variant={selectedCategory === null ? "default" : "outline"}
          onClick={() => onCategoryChange(null)}
          className="flex items-center space-x-1"
        >
          <Filter className="h-3 w-3" />
          <span>Todos</span>
          <Badge variant="secondary" className="ml-1">
            {chats.length}
          </Badge>
        </Button>

        {/* Categorías del sistema y personalizadas */}
        {allCategories.map((category) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap] || MessageCircle;
          const isSelected = selectedCategory === (category.id?.toString() || category.id);
          
          return (
            <Button
              key={category.id}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              onClick={() => onCategoryChange(category.id?.toString() || category.id)}
              className="flex items-center space-x-1"
              style={{
                backgroundColor: isSelected ? category.color : 'transparent',
                borderColor: category.color,
                color: isSelected ? 'white' : category.color
              }}
            >
              <IconComponent className="h-3 w-3" />
              <span>{category.name}</span>
              {category.count !== undefined && (
                <Badge variant="secondary" className="ml-1">
                  {category.count}
                </Badge>
              )}
            </Button>
          );
        })}
      </div>
    </div>
  );
}