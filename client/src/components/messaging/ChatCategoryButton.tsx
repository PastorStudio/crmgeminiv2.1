import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  FolderOpen, 
  User, 
  Users, 
  TrendingUp, 
  HelpCircle, 
  MessageCircle,
  Tag
} from 'lucide-react';

interface Category {
  id: number;
  name: string;
  color: string;
  icon: string;
}

interface ChatCategoryButtonProps {
  chatId: string;
  accountId: number;
  isGroup?: boolean;
  size?: 'sm' | 'xs';
}

const iconMap = {
  User,
  Users,
  TrendingUp,
  HelpCircle,
  MessageCircle,
  FolderOpen,
  Tag
};

export function ChatCategoryButton({ 
  chatId, 
  accountId, 
  isGroup = false,
  size = 'xs'
}: ChatCategoryButtonProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);

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

  const loadCurrentCategory = async () => {
    try {
      const response = await fetch(`/api/chat-categories/chat/${chatId}/${accountId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.category) {
          setCurrentCategory(data.category);
        }
      }
    } catch (error) {
      console.error('Error cargando categoría actual:', error);
    }
  };

  const assignCategory = async (categoryId: number) => {
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
          const category = categories.find(c => c.id === categoryId);
          setCurrentCategory(category || null);
        }
      }
    } catch (error) {
      console.error('Error asignando categoría:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadCurrentCategory();
  }, [chatId, accountId]);

  // Categorías predeterminadas del sistema
  const systemCategories = [
    { 
      id: -1, 
      name: isGroup ? 'Grupo' : 'Individual', 
      color: isGroup ? '#8B5CF6' : '#10B981', 
      icon: isGroup ? 'Users' : 'User'
    }
  ];

  const allCategories = [...systemCategories, ...categories];

  if (currentCategory) {
    const IconComponent = iconMap[currentCategory.icon as keyof typeof iconMap] || Tag;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={size}
            variant="outline"
            className="h-6 px-2 text-xs border-0 bg-transparent hover:bg-gray-100"
            style={{ color: currentCategory.color }}
            disabled={loading}
          >
            <IconComponent className="h-3 w-3 mr-1" />
            {currentCategory.name}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {allCategories.map((category) => {
            const IconComponent = iconMap[category.icon as keyof typeof iconMap] || Tag;
            return (
              <DropdownMenuItem
                key={category.id}
                onClick={() => assignCategory(category.id)}
                className="flex items-center space-x-2"
              >
                <IconComponent 
                  className="h-4 w-4" 
                  style={{ color: category.color }}
                />
                <span>{category.name}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Si no tiene categoría, mostrar botón para asignar
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size={size}
          variant="ghost"
          className="h-6 px-2 text-xs text-gray-400 hover:text-gray-600"
          disabled={loading}
        >
          <FolderOpen className="h-3 w-3 mr-1" />
          Categoría
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {allCategories.map((category) => {
          const IconComponent = iconMap[category.icon as keyof typeof iconMap] || Tag;
          return (
            <DropdownMenuItem
              key={category.id}
              onClick={() => assignCategory(category.id)}
              className="flex items-center space-x-2"
            >
              <IconComponent 
                className="h-4 w-4" 
                style={{ color: category.color }}
              />
              <span>{category.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}