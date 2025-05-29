import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Search, 
  Plus, 
  Users, 
  User, 
  Tag, 
  Loader2,
  MessageSquare,
  Phone,
  Video,
  MoreVertical
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

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
  onChatSelect?: (chat: Chat) => void;
}

export const WhatsAppCategorized: React.FC<WhatsAppCategorizedProps> = ({
  onChatSelect
}) => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [chatType, setChatType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = useState(false);
  const [newCategoryData, setNewCategoryData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    icon: '📁'
  });

  const queryClient = useQueryClient();

  // Fetch WhatsApp accounts
  const { data: whatsappAccountsData = [] } = useQuery({
    queryKey: ['/api/whatsapp-accounts']
  });
  
  const whatsappAccounts = Array.isArray(whatsappAccountsData) ? whatsappAccountsData as any[] : [];

  // Auto-select all available accounts when they load
  useEffect(() => {
    if (whatsappAccounts.length > 0 && selectedAccounts.length === 0) {
      const accountIds = whatsappAccounts.map((account: any) => account.id.toString());
      setSelectedAccounts(accountIds);
      console.log('Auto-selecting accounts:', accountIds);
    }
  }, [whatsappAccounts.length, selectedAccounts.length]);

  // Fetch chats from selected accounts
  const { data: chats = [], isLoading: loadingChats } = useQuery({
    queryKey: ['/api/whatsapp/chats', selectedAccounts],
    queryFn: async () => {
      if (selectedAccounts.length === 0) return [];
      
      const chatPromises = selectedAccounts.map(async (accountId) => {
        const response = await fetch(`/api/whatsapp-accounts/${accountId}/chats`);
        if (!response.ok) return [];
        const accountChats = await response.json();
        return accountChats.map((chat: any) => ({
          ...chat,
          accountId: parseInt(accountId)
        }));
      });
      
      const allChats = await Promise.all(chatPromises);
      return allChats.flat();
    },
    enabled: selectedAccounts.length > 0
  });

  // Fetch categories
  const { data: categoriesData = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['/api/chat-categories']
  });
  
  const categories = Array.isArray(categoriesData) ? categoriesData as Category[] : [];

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: (data: typeof newCategoryData) => 
      fetch('/api/chat-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat-categories'] });
      setShowCreateCategoryDialog(false);
      setNewCategoryData({
        name: '',
        description: '',
        color: '#3B82F6',
        icon: '📁'
      });
    }
  });

  // Assign category mutation
  const assignCategoryMutation = useMutation({
    mutationFn: ({ chatId, accountId, categoryId }: { chatId: string; accountId: number; categoryId: number }) =>
      fetch('/api/chat-categories/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, accountId, categoryId })
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
    }
  });

  const handleChatSelect = (chat: Chat) => {
    setSelectedChat(chat);
    onChatSelect?.(chat);
  };

  const handleCategoryAssign = (chat: Chat, categoryId: number) => {
    assignCategoryMutation.mutate({
      chatId: chat.id,
      accountId: chat.accountId,
      categoryId
    });
  };

  // Filter chats
  const filteredChats = chats.filter((chat: Chat) => {
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         chat.lastMessage.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = chatType === 'all' || 
                       (chatType === 'individual' && !chat.isGroup) ||
                       (chatType === 'group' && chat.isGroup);
    return matchesSearch && matchesType;
  });

  return (
    <div className="flex h-full bg-gray-50">
      {/* Chat List Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-900 to-red-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Mensajes</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowCreateCategoryDialog(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Account Selection */}
          <Select
            value={selectedAccounts.join(',')}
            onValueChange={(value) => {
              if (value === 'all') {
                setSelectedAccounts(whatsappAccounts.map((acc: any) => acc.id.toString()));
              } else {
                setSelectedAccounts([value]);
              }
            }}
          >
            <SelectTrigger className="mb-3 bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Seleccionar cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cuentas</SelectItem>
              {whatsappAccounts.map((account: any) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  {account.name} ({account.ownerName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Search and Filters */}
        <div className="p-3 border-b border-gray-200 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Type Filter */}
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant={chatType === 'all' ? 'default' : 'outline'}
              onClick={() => setChatType('all')}
              className="flex-1 h-8"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Todos
            </Button>
            <Button
              size="sm"
              variant={chatType === 'individual' ? 'default' : 'outline'}
              onClick={() => setChatType('individual')}
              className="flex-1 h-8"
            >
              <User className="h-3 w-3 mr-1" />
              Individual
            </Button>
            <Button
              size="sm"
              variant={chatType === 'group' ? 'default' : 'outline'}
              onClick={() => setChatType('group')}
              className="flex-1 h-8"
            >
              <Users className="h-3 w-3 mr-1" />
              Grupos
            </Button>
          </div>

          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  <div className="flex items-center">
                    <div 
                      className="w-3 h-3 rounded-full mr-2" 
                      style={{ backgroundColor: category.color }}
                    />
                    {category.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No hay chats disponibles</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatListItem
                key={`${chat.accountId}-${chat.id}`}
                chat={chat}
                isSelected={selectedChat?.id === chat.id}
                onClick={() => handleChatSelect(chat)}
                categories={categories}
                onCategoryChange={(categoryId) => handleCategoryAssign(chat, categoryId)}
                categoryLoading={assignCategoryMutation.isPending}
              />
            ))
          )}
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex-1">
        {selectedChat ? (
          <ChatInterface chat={selectedChat} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Selecciona un chat
              </h3>
              <p className="text-gray-500">
                Elige una conversación para ver los mensajes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showCreateCategoryDialog} onOpenChange={setShowCreateCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Nueva Categoría</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input
                value={newCategoryData.name}
                onChange={(e) => setNewCategoryData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre de la categoría"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Descripción</label>
              <Input
                value={newCategoryData.description}
                onChange={(e) => setNewCategoryData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción opcional"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Color</label>
              <div className="flex space-x-2 mt-1">
                {['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'].map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newCategoryData.color === color ? 'border-gray-400' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategoryData(prev => ({ ...prev, color }))}
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

// ChatListItem component with category management and profile pictures
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
  const [showProfileImage, setShowProfileImage] = useState(false);

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowProfileImage(true);
  };

  return (
    <>
      <div 
        className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 relative ${
          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
        }`}
        onClick={onClick}
      >
        <div className="flex items-start space-x-3">
          {/* Profile Picture */}
          <div className="flex-shrink-0">
            <Avatar 
              className="h-12 w-12 cursor-pointer ring-2 ring-gray-200 hover:ring-blue-400 transition-all"
              onClick={handleProfileClick}
            >
              <AvatarImage 
                src={chat.profilePicUrl || `/api/whatsapp-accounts/${chat.accountId}/contact/${chat.id}/profile-pic`}
                alt={chat.name}
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white font-semibold">
                {chat.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

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

      {/* Profile Image Dialog */}
      <Dialog open={showProfileImage} onOpenChange={setShowProfileImage}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={chat.profilePicUrl || `/api/whatsapp-accounts/${chat.accountId}/contact/${chat.id}/profile-pic`}
                  alt={chat.name}
                />
                <AvatarFallback className="bg-gradient-to-br from-blue-400 to-purple-500 text-white">
                  {chat.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{chat.name}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex items-center justify-center p-4">
            <img 
              src={chat.profilePicUrl || `/api/whatsapp-accounts/${chat.accountId}/contact/${chat.id}/profile-pic`}
              alt={chat.name}
              className="max-w-full max-h-96 rounded-lg shadow-lg object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Simple Chat Interface component
function ChatInterface({ chat }: { chat: Chat }) {
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-10 w-10">
              <AvatarImage 
                src={chat.profilePicUrl || `/api/whatsapp-accounts/${chat.accountId}/contact/${chat.id}/profile-pic`}
                alt={chat.name}
              />
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
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Video className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 bg-gray-50 p-4">
        <div className="text-center py-8 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Mensajes del chat aparecerán aquí</p>
        </div>
      </div>
    </div>
  );
}