import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User, Users, MessageCircle, Tag, Plus, Send, Search, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  timestamp: number;
  unreadCount: number;
  isGroup: boolean;
  accountId: number;
  profilePicUrl?: string;
}

interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
}

interface WhatsAppCategorizedProps {
  selectedAccounts: number[];
  onChatSelect?: (chat: Chat) => void;
}

export const WhatsAppCategorized: React.FC<WhatsAppCategorizedProps> = ({
  selectedAccounts,
  onChatSelect
}) => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'individual' | 'groups'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false);
  const [categoryLoadingChat, setCategoryLoadingChat] = useState<string | null>(null);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: 'MessageCircle'
  });

  const queryClient = useQueryClient();

  // Fetch chats
  const { data: chats = [], isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    enabled: selectedAccounts.length > 0
  });

  // Fetch categories
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['/api/chat-categories']
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (data: typeof newCategoryData) => 
      apiRequest('/api/chat-categories', { method: 'POST', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories'] });
      setShowCreateCategoryDialog(false);
      setNewCategoryData({
        name: '',
        description: '',
        color: '#3B82F6',
        icon: 'MessageCircle'
      });
    }
  });

  // Assign category mutation
  const assignCategoryMutation = useMutation({
    mutationFn: ({ chatId, accountId, categoryId }: { chatId: string; accountId: number; categoryId: number }) =>
      apiRequest('/api/chat-categories/assign', { 
        method: 'POST', 
        body: { chatId, accountId, categoryId } 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setCategoryLoadingChat(null);
    },
    onError: () => {
      setCategoryLoadingChat(null);
    }
  });

  // Filtered and sorted chats
  const filteredChats = useMemo(() => {
    let filtered = Array.isArray(chats) ? chats : [];
    
    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(chat => 
        chat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        chat.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Filter by chat type
    if (chatTypeFilter === 'individual') {
      filtered = filtered.filter(chat => !chat.isGroup);
    } else if (chatTypeFilter === 'groups') {
      filtered = filtered.filter(chat => chat.isGroup);
    }
    
    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [chats, searchQuery, chatTypeFilter]);

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    onChatSelect?.(chat);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Left Panel - Chat List with Categories */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Account Selection Header */}
        <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Cuentas WhatsApp</h2>
            <Badge variant="secondary" className="text-xs">
              {selectedAccounts.length} activas
            </Badge>
          </div>
          <div className="text-sm text-gray-600">
            Cuentas seleccionadas: {selectedAccounts.join(', ')}
          </div>
        </div>

        {/* Chat Header and Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-medium text-gray-900">Conversaciones</h3>
            <Button
              size="sm"
              onClick={() => setShowCreateCategoryDialog(true)}
              className="h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Categoría
            </Button>
          </div>
          
          {/* Search Bar */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-8"
            />
          </div>

          {/* Chat Type Filters - Smaller */}
          <div className="flex gap-1 mb-2">
            <Button
              size="sm"
              variant={chatTypeFilter === 'all' ? "default" : "outline"}
              onClick={() => setChatTypeFilter('all')}
              className="h-6 px-2 text-xs flex items-center space-x-1"
            >
              <MessageCircle className="h-2.5 w-2.5" />
              <span>Todos</span>
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {filteredChats.length}
              </Badge>
            </Button>
            
            <Button
              size="sm"
              variant={chatTypeFilter === 'individual' ? "default" : "outline"}
              onClick={() => setChatTypeFilter('individual')}
              className="h-6 px-2 text-xs flex items-center space-x-1"
              style={{
                backgroundColor: chatTypeFilter === 'individual' ? '#10B981' : 'transparent',
                borderColor: '#10B981',
                color: chatTypeFilter === 'individual' ? 'white' : '#10B981'
              }}
            >
              <User className="h-2.5 w-2.5" />
              <span>Individual</span>
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {filteredChats.filter(chat => !chat.isGroup).length}
              </Badge>
            </Button>

            <Button
              size="sm"
              variant={chatTypeFilter === 'groups' ? "default" : "outline"}
              onClick={() => setChatTypeFilter('groups')}
              className="h-6 px-2 text-xs flex items-center space-x-1"
              style={{
                backgroundColor: chatTypeFilter === 'groups' ? '#8B5CF6' : 'transparent',
                borderColor: '#8B5CF6',
                color: chatTypeFilter === 'groups' ? 'white' : '#8B5CF6'
              }}
            >
              <Users className="h-2.5 w-2.5" />
              <span>Grupos</span>
              <Badge variant="secondary" className="ml-1 text-[10px] h-4 px-1">
                {filteredChats.filter(chat => chat.isGroup).length}
              </Badge>
            </Button>
          </div>

          {/* Category Filters - Below search */}
          {categories.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              <Button
                size="sm"
                variant={selectedCategory === null ? "default" : "outline"}
                onClick={() => setSelectedCategory(null)}
                className="h-5 px-2 text-[10px]"
              >
                Sin categoría
              </Button>
              {categories.map((category: any) => (
                <Button
                  key={category.id}
                  size="sm"
                  variant={selectedCategory === category.id.toString() ? "default" : "outline"}
                  onClick={() => setSelectedCategory(
                    selectedCategory === category.id.toString() ? null : category.id.toString()
                  )}
                  className="h-5 px-2 text-[10px]"
                  style={{
                    backgroundColor: selectedCategory === category.id.toString() ? category.color : 'transparent',
                    borderColor: category.color,
                    color: selectedCategory === category.id.toString() ? 'white' : category.color
                  }}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {loadingChats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Cargando chats...</span>
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {selectedAccounts.length === 0 
                  ? "Selecciona una cuenta para ver los chats"
                  : "No hay chats disponibles"
                }
              </div>
            ) : (
              filteredChats.map((chat) => (
                <ChatListItem 
                  key={chat.id} 
                  chat={chat} 
                  isSelected={selectedChat?.id === chat.id}
                  onClick={() => handleChatSelect(chat)}
                  categories={categories}
                  onCategoryChange={(categoryId) => {
                    setCategoryLoadingChat(chat.id);
                    assignCategoryMutation.mutate({
                      chatId: chat.id,
                      accountId: chat.accountId,
                      categoryId
                    });
                  }}
                  categoryLoading={categoryLoadingChat === chat.id}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right Panel - Chat Interface */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <ChatInterface chat={selectedChat} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona un chat</h3>
              <p className="text-gray-500">Elige una conversación para comenzar</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategoryDialog} onOpenChange={setShowCreateCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Categoría</DialogTitle>
            <DialogDescription>
              Crea una categoría personalizada para organizar tus chats
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, name: e.target.value })}
                placeholder="Nombre de la categoría"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={newCategoryData.description}
                onChange={(e) => setNewCategoryData({ ...newCategoryData, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex gap-2 mt-2">
                {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newCategoryData.color === color ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryData({ ...newCategoryData, color })}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => createCategoryMutation.mutate(newCategoryData)}
              disabled={!newCategoryData.name || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? 'Creando...' : 'Crear Categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ChatListItem component with category management
function ChatListItem({ 
  chat, 
  isSelected, 
  onClick, 
  categories, 
  onCategoryChange, 
  categoryLoading 
}: {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
  categories: Category[];
  onCategoryChange: (categoryId: number) => void;
  categoryLoading: boolean;
}) {
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);

  return (
    <div 
      className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 relative ${
        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            <div className="flex items-center space-x-2">
              {chat.isGroup ? <Users className="h-4 w-4 text-gray-500" /> : <User className="h-4 w-4 text-gray-500" />}
              <span className="font-medium text-gray-900 truncate">{chat.name}</span>
            </div>
          </div>
          
          <p className="text-sm text-gray-600 truncate">{chat.lastMessage}</p>
          
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              {new Date(chat.timestamp).toLocaleTimeString('es-ES', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
            
            {chat.unreadCount > 0 && (
              <Badge variant="default" className="bg-green-500">
                {chat.unreadCount}
              </Badge>
            )}
          </div>
        </div>
        
        {/* Category Management Button */}
        <Popover open={showCategoryMenu} onOpenChange={setShowCategoryMenu}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                setShowCategoryMenu(true);
              }}
            >
              {categoryLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Tag className="h-3 w-3" />
              )}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              <div className="text-xs font-medium text-gray-500 px-2 py-1">
                Asignar categoría
              </div>
              
              {categories.map((category) => (
                <Button
                  key={category.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-auto p-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCategoryChange(category.id);
                    setShowCategoryMenu(false);
                  }}
                >
                  <div 
                    className="w-3 h-3 rounded-full mr-2" 
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm">{category.name}</span>
                </Button>
              ))}
              
              {categories.length === 0 && (
                <div className="text-xs text-gray-500 px-2 py-1">
                  No hay categorías disponibles
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Simple Chat Interface component
function ChatInterface({ chat }: { chat: Chat }) {
  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={chat.profilePicUrl} />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
              {chat.isGroup ? <Users className="h-5 w-5" /> : chat.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium text-gray-900">{chat.name}</h2>
            <p className="text-sm text-gray-500">
              {chat.isGroup ? 'Grupo' : 'Chat individual'} • Cuenta #{chat.accountId}
            </p>
          </div>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 bg-gray-50 p-4">
        <div className="text-center text-gray-500">
          <MessageCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Conversación con {chat.name}</p>
          <p className="text-sm mt-1">Sistema de categorización activo</p>
        </div>
      </div>
      
      {/* Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <Input 
            placeholder="Escribe un mensaje..." 
            className="flex-1"
          />
          <Button size="sm">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}