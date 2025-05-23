import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Loader2, Clock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChatComment {
  id: number;
  chatId: string;
  comment: string;
  userId: number;
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    username: string;
    role: string;
    avatar?: string;
  };
}

interface ChatCommentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatId: string;
  chatName: string;
}

export function ChatCommentsDialog({ 
  open, 
  onOpenChange, 
  chatId, 
  chatName 
}: ChatCommentsDialogProps) {
  const [newComment, setNewComment] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Cargar comentarios del chat
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['chat-comments', chatId],
    queryFn: async () => {
      console.log('💬 Cargando comentarios para chat:', chatId);
      const response = await fetch(`/api/chat-comments/${encodeURIComponent(chatId)}`);
      if (!response.ok) {
        throw new Error('Error al cargar comentarios');
      }
      const data = await response.json();
      console.log('✅ Comentarios cargados:', data);
      return data;
    },
    enabled: open && !!chatId,
  });

  // Obtener información del usuario actual
  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      const response = await fetch('/api/system/users');
      if (!response.ok) throw new Error('Error al obtener usuarios');
      const users = await response.json();
      // Por ahora retornamos el primer usuario activo como usuario actual
      // TODO: Implementar autenticación real
      return users.find((u: any) => u.status === 'active') || users[0];
    },
  });

  // Agregar nuevo comentario
  const addCommentMutation = useMutation({
    mutationFn: async (comment: string) => {
      console.log('💬 Agregando comentario:', { chatId, comment, userId: currentUser?.id });
      const response = await fetch('/api/chat-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId,
          comment: comment.trim(),
          userId: currentUser?.id || 1
        })
      });
      
      if (!response.ok) {
        throw new Error('Error al agregar comentario');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['chat-comments', chatId] });
      toast({
        title: "Comentario agregado",
        description: "El comentario interno se ha guardado correctamente",
      });
    },
    onError: (error) => {
      console.error('❌ Error al agregar comentario:', error);
      toast({
        title: "Error",
        description: "No se pudo agregar el comentario",
        variant: "destructive",
      });
    }
  });

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'supervisor':
        return 'bg-purple-100 text-purple-700';
      case 'agent':
        return 'bg-blue-100 text-blue-700';
      case 'admin':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-orange-600" />
            <span>Comentarios Internos</span>
            <Badge variant="outline" className="ml-2">
              {chatName}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Comentarios privados del sistema - No visibles para el cliente de WhatsApp
          </p>
        </DialogHeader>

        {/* Lista de comentarios */}
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Cargando comentarios...</span>
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <MessageSquare className="h-12 w-12 mb-3 text-gray-300" />
                <p className="text-sm">No hay comentarios internos aún</p>
                <p className="text-xs text-gray-400 mt-1">
                  Sé el primero en agregar un comentario sobre este chat
                </p>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {comments.map((comment: ChatComment, index: number) => (
                  <Card key={comment.id} className="p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        {comment.user?.avatar ? (
                          <AvatarImage src={comment.user.avatar} />
                        ) : (
                          <AvatarFallback className="bg-orange-100 text-orange-700 text-xs">
                            {getInitials(comment.user?.fullName || 'Usuario')}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 text-sm">
                              {comment.user?.fullName || 'Usuario Desconocido'}
                            </span>
                            <Badge 
                              variant="secondary"
                              className={getRoleColor(comment.user?.role || '')}
                            >
                              {comment.user?.role || 'usuario'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3" />
                            <span>{formatDate(comment.timestamp || comment.createdAt)}</span>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {comment.text || comment.comment}
                        </p>
                      </div>
                    </div>
                    
                    {index < comments.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Agregar nuevo comentario */}
        <div className="border-t pt-4 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Agregar comentario interno
            </label>
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Escribe un comentario sobre este chat (solo visible para agentes del sistema)..."
              className="min-h-[80px] resize-none"
              disabled={addCommentMutation.isPending}
            />
            <p className="text-xs text-gray-500">
              Presiona Ctrl+Enter para enviar rápidamente
            </p>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <User className="h-3 w-3" />
              <span>Sistema interno - No se envía a WhatsApp</span>
            </div>
            
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </Button>
              <Button 
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || addCommentMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {addCommentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Send className="h-4 w-4 mr-1" />
                )}
                Agregar Comentario
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}