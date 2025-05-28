import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  User, 
  Calendar, 
  MessageSquare, 
  Tag, 
  FileText, 
  Image, 
  Video, 
  Mic,
  Users,
  ChevronDown,
  ChevronRight,
  Hash
} from 'lucide-react';

interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  hasMedia: boolean;
  type: string;
  author?: string;
  chatId: string;
  authorProfilePic?: string;
  authorNumber?: string;
}

interface MessageGroup {
  id: string;
  title: string;
  subtitle?: string;
  messages: Message[];
  count: number;
  icon: React.ReactNode;
  color: string;
  timestamp?: number;
}

interface SmartMessageGroupingProps {
  messages: Message[];
  onMessageClick?: (message: Message) => void;
  onGroupClick?: (group: MessageGroup) => void;
}

type GroupingMode = 'time' | 'sender' | 'type' | 'conversation' | 'date' | 'none';

export function SmartMessageGrouping({ messages, onMessageClick, onGroupClick }: SmartMessageGroupingProps) {
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('time');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showGroupControls, setShowGroupControls] = useState(true);

  // Smart grouping logic
  const groupedMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    switch (groupingMode) {
      case 'time':
        return groupByTime(messages);
      case 'sender':
        return groupBySender(messages);
      case 'type':
        return groupByType(messages);
      case 'conversation':
        return groupByConversation(messages);
      case 'date':
        return groupByDate(messages);
      case 'none':
      default:
        return [{
          id: 'all',
          title: 'Todos los mensajes',
          messages: messages.sort((a, b) => b.timestamp - a.timestamp),
          count: messages.length,
          icon: <MessageSquare className="h-4 w-4" />,
          color: 'bg-blue-100 text-blue-800'
        }];
    }
  }, [messages, groupingMode]);

  // Group by time periods (last hour, today, yesterday, this week, etc.)
  function groupByTime(messages: Message[]): MessageGroup[] {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    const oneDay = 24 * oneHour;
    const oneWeek = 7 * oneDay;

    const groups: { [key: string]: Message[] } = {
      'last-hour': [],
      'today': [],
      'yesterday': [],
      'this-week': [],
      'older': []
    };

    messages.forEach(message => {
      const messageTime = message.timestamp * 1000;
      const timeDiff = now - messageTime;

      if (timeDiff < oneHour) {
        groups['last-hour'].push(message);
      } else if (timeDiff < oneDay) {
        groups['today'].push(message);
      } else if (timeDiff < 2 * oneDay) {
        groups['yesterday'].push(message);
      } else if (timeDiff < oneWeek) {
        groups['this-week'].push(message);
      } else {
        groups['older'].push(message);
      }
    });

    return [
      {
        id: 'last-hour',
        title: 'Última hora',
        subtitle: `${groups['last-hour'].length} mensajes`,
        messages: groups['last-hour'].sort((a, b) => b.timestamp - a.timestamp),
        count: groups['last-hour'].length,
        icon: <Clock className="h-4 w-4" />,
        color: 'bg-green-100 text-green-800'
      },
      {
        id: 'today',
        title: 'Hoy',
        subtitle: `${groups['today'].length} mensajes`,
        messages: groups['today'].sort((a, b) => b.timestamp - a.timestamp),
        count: groups['today'].length,
        icon: <Calendar className="h-4 w-4" />,
        color: 'bg-blue-100 text-blue-800'
      },
      {
        id: 'yesterday',
        title: 'Ayer',
        subtitle: `${groups['yesterday'].length} mensajes`,
        messages: groups['yesterday'].sort((a, b) => b.timestamp - a.timestamp),
        count: groups['yesterday'].length,
        icon: <Calendar className="h-4 w-4" />,
        color: 'bg-yellow-100 text-yellow-800'
      },
      {
        id: 'this-week',
        title: 'Esta semana',
        subtitle: `${groups['this-week'].length} mensajes`,
        messages: groups['this-week'].sort((a, b) => b.timestamp - a.timestamp),
        count: groups['this-week'].length,
        icon: <Calendar className="h-4 w-4" />,
        color: 'bg-purple-100 text-purple-800'
      },
      {
        id: 'older',
        title: 'Anteriores',
        subtitle: `${groups['older'].length} mensajes`,
        messages: groups['older'].sort((a, b) => b.timestamp - a.timestamp),
        count: groups['older'].length,
        icon: <Clock className="h-4 w-4" />,
        color: 'bg-gray-100 text-gray-800'
      }
    ].filter(group => group.count > 0);
  }

  // Group by sender (fromMe vs others, or by author)
  function groupBySender(messages: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const key = message.fromMe ? 'me' : (message.author || 'unknown');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(message);
    });

    return Object.entries(groups).map(([sender, msgs]) => ({
      id: sender,
      title: sender === 'me' ? 'Mis mensajes' : (sender === 'unknown' ? 'Contacto' : sender),
      subtitle: `${msgs.length} mensajes`,
      messages: msgs.sort((a, b) => b.timestamp - a.timestamp),
      count: msgs.length,
      icon: sender === 'me' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />,
      color: sender === 'me' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
    }));
  }

  // Group by message type (text, image, video, audio, etc.)
  function groupByType(messages: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {
      'text': [],
      'image': [],
      'video': [],
      'audio': [],
      'document': [],
      'other': []
    };

    messages.forEach(message => {
      if (!message.hasMedia) {
        groups['text'].push(message);
      } else {
        switch (message.type) {
          case 'image':
            groups['image'].push(message);
            break;
          case 'video':
            groups['video'].push(message);
            break;
          case 'ptt':
          case 'audio':
            groups['audio'].push(message);
            break;
          case 'document':
            groups['document'].push(message);
            break;
          default:
            groups['other'].push(message);
        }
      }
    });

    const typeIcons = {
      'text': <MessageSquare className="h-4 w-4" />,
      'image': <Image className="h-4 w-4" />,
      'video': <Video className="h-4 w-4" />,
      'audio': <Mic className="h-4 w-4" />,
      'document': <FileText className="h-4 w-4" />,
      'other': <Tag className="h-4 w-4" />
    };

    const typeColors = {
      'text': 'bg-blue-100 text-blue-800',
      'image': 'bg-green-100 text-green-800',
      'video': 'bg-purple-100 text-purple-800',
      'audio': 'bg-yellow-100 text-yellow-800',
      'document': 'bg-red-100 text-red-800',
      'other': 'bg-gray-100 text-gray-800'
    };

    const typeNames = {
      'text': 'Mensajes de texto',
      'image': 'Imágenes',
      'video': 'Videos',
      'audio': 'Mensajes de voz',
      'document': 'Documentos',
      'other': 'Otros archivos'
    };

    return Object.entries(groups)
      .filter(([_, msgs]) => msgs.length > 0)
      .map(([type, msgs]) => ({
        id: type,
        title: typeNames[type as keyof typeof typeNames],
        subtitle: `${msgs.length} ${type === 'text' ? 'mensajes' : 'archivos'}`,
        messages: msgs.sort((a, b) => b.timestamp - a.timestamp),
        count: msgs.length,
        icon: typeIcons[type as keyof typeof typeIcons],
        color: typeColors[type as keyof typeof typeColors]
      }));
  }

  // Group by conversation threads (consecutive messages from same sender)
  function groupByConversation(messages: Message[]): MessageGroup[] {
    const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
    const groups: MessageGroup[] = [];
    let currentGroup: Message[] = [];
    let currentSender: string | null = null;
    let groupCounter = 1;

    sortedMessages.forEach((message, index) => {
      const sender = message.fromMe ? 'me' : (message.author || 'other');
      
      if (sender !== currentSender) {
        if (currentGroup.length > 0) {
          groups.push({
            id: `conversation-${groupCounter++}`,
            title: `Conversación ${currentSender === 'me' ? 'propia' : 'del contacto'}`,
            subtitle: `${currentGroup.length} mensajes consecutivos`,
            messages: currentGroup,
            count: currentGroup.length,
            icon: currentSender === 'me' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />,
            color: currentSender === 'me' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800',
            timestamp: currentGroup[0].timestamp
          });
        }
        currentGroup = [message];
        currentSender = sender;
      } else {
        currentGroup.push(message);
      }

      // Add last group
      if (index === sortedMessages.length - 1 && currentGroup.length > 0) {
        groups.push({
          id: `conversation-${groupCounter++}`,
          title: `Conversación ${currentSender === 'me' ? 'propia' : 'del contacto'}`,
          subtitle: `${currentGroup.length} mensajes consecutivos`,
          messages: currentGroup,
          count: currentGroup.length,
          icon: currentSender === 'me' ? <User className="h-4 w-4" /> : <Users className="h-4 w-4" />,
          color: currentSender === 'me' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800',
          timestamp: currentGroup[0].timestamp
        });
      }
    });

    return groups.reverse(); // Most recent conversations first
  }

  // Group by date
  function groupByDate(messages: Message[]): MessageGroup[] {
    const groups: { [key: string]: Message[] } = {};

    messages.forEach(message => {
      const date = new Date(message.timestamp * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(message);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, msgs]) => ({
        id: date,
        title: new Date(date).toLocaleDateString('es-ES', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        subtitle: `${msgs.length} mensajes`,
        messages: msgs.sort((a, b) => b.timestamp - a.timestamp),
        count: msgs.length,
        icon: <Calendar className="h-4 w-4" />,
        color: 'bg-indigo-100 text-indigo-800'
      }));
  }

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      {/* Grouping Controls */}
      {showGroupControls && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hash className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Agrupación Inteligente</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowGroupControls(false)}
                className="text-blue-600 hover:text-blue-800"
              >
                Ocultar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-blue-800">Agrupar por:</label>
              <Select value={groupingMode} onValueChange={(value: GroupingMode) => setGroupingMode(value)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">⏰ Tiempo</SelectItem>
                  <SelectItem value="sender">👤 Remitente</SelectItem>
                  <SelectItem value="type">📎 Tipo de mensaje</SelectItem>
                  <SelectItem value="conversation">💬 Conversaciones</SelectItem>
                  <SelectItem value="date">📅 Fecha</SelectItem>
                  <SelectItem value="none">📝 Sin agrupar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {!showGroupControls && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGroupControls(true)}
            className="text-blue-600 border-blue-200"
          >
            <Hash className="h-4 w-4 mr-2" />
            Mostrar controles de agrupación
          </Button>
        </div>
      )}

      {/* Message Groups */}
      <div className="space-y-3">
        {groupedMessages.map((group) => {
          const isExpanded = expandedGroups.has(group.id);
          
          return (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader 
                className="pb-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => {
                  toggleGroupExpansion(group.id);
                  onGroupClick?.(group);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {isExpanded ? 
                        <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      }
                      {group.icon}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{group.title}</h3>
                      {group.subtitle && (
                        <p className="text-sm text-gray-500">{group.subtitle}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className={group.color}>
                    {group.count}
                  </Badge>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="mb-4" />
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {group.messages.map((message) => (
                      <div
                        key={message.id}
                        className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => onMessageClick?.(message)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={message.authorProfilePic} />
                          <AvatarFallback className={message.fromMe ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}>
                            {message.fromMe ? 'Yo' : (message.author?.charAt(0) || 'C')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {message.fromMe ? 'Tú' : (message.author || 'Contacto')}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatMessageTime(message.timestamp)}
                            </p>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            {message.hasMedia && (
                              <div className="flex items-center space-x-1 text-gray-500">
                                {message.type === 'image' && <Image className="h-3 w-3" />}
                                {message.type === 'video' && <Video className="h-3 w-3" />}
                                {(message.type === 'ptt' || message.type === 'audio') && <Mic className="h-3 w-3" />}
                                {message.type === 'document' && <FileText className="h-3 w-3" />}
                              </div>
                            )}
                            <p className="text-sm text-gray-600 truncate">
                              {message.hasMedia ? `${message.type} - ${message.body || 'Archivo multimedia'}` : message.body}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {groupedMessages.length === 0 && (
        <Card className="p-8 text-center">
          <div className="flex flex-col items-center space-y-3">
            <MessageSquare className="h-12 w-12 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900">No hay mensajes para agrupar</h3>
            <p className="text-gray-500">Los mensajes aparecerán aquí cuando estén disponibles</p>
          </div>
        </Card>
      )}
    </div>
  );
}