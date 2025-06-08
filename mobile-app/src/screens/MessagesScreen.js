import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Title,
  Text,
  Button,
  Surface,
  ActivityIndicator,
  Chip,
  Searchbar,
  Avatar,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/ApiService';

export default function MessagesScreen() {
  const [messages, setMessages] = useState([]);
  const [whatsappAccounts, setWhatsappAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMessages();
    loadWhatsAppAccounts();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const messagesData = await ApiService.getWhatsAppMessages();
      setMessages(messagesData || []);
    } catch (error) {
      console.error('Messages loading error:', error);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadWhatsAppAccounts = async () => {
    try {
      const accountsData = await ApiService.getWhatsAppAccounts();
      setWhatsappAccounts(accountsData?.accounts || []);
    } catch (error) {
      console.error('WhatsApp accounts loading error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    await loadWhatsAppAccounts();
    setRefreshing(false);
  };

  const convertChatsToLeads = async () => {
    try {
      const result = await ApiService.convertWhatsAppChatsToLeads();
      Alert.alert(
        'Conversión Exitosa',
        `${result.leadsCreated} nuevos leads creados desde conversaciones reales`
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudieron convertir los chats a leads');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit' 
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const filteredMessages = messages.filter(message =>
    searchQuery === '' ||
    message.from?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    message.body?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando mensajes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Title>Mensajes de WhatsApp</Title>
        
        {/* WhatsApp Accounts Status */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountsContainer}>
          {whatsappAccounts.map((account, index) => (
            <Chip
              key={index}
              mode="outlined"
              style={[
                styles.accountChip,
                { 
                  backgroundColor: account.status === 'Conectado' ? '#dcfce7' : '#fee2e2',
                  borderColor: account.status === 'Conectado' ? '#16a34a' : '#dc2626'
                }
              ]}
              textStyle={{
                color: account.status === 'Conectado' ? '#16a34a' : '#dc2626'
              }}
            >
              {account.name || 'WhatsApp'}: {account.status || 'Desconectado'}
            </Chip>
          ))}
        </ScrollView>

        <Searchbar
          placeholder="Buscar conversaciones..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />

        <Button
          mode="contained"
          onPress={convertChatsToLeads}
          icon="people"
          style={styles.convertButton}
          buttonColor="#10b981"
        >
          Convertir a Leads
        </Button>
      </View>

      {/* Messages List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredMessages.length > 0 ? (
          filteredMessages.map((message, index) => (
            <Card key={index} style={styles.messageCard}>
              <Card.Content>
                <View style={styles.messageHeader}>
                  <View style={styles.contactInfo}>
                    <Avatar.Text
                      size={40}
                      label={getInitials(message.notifyName || message.from)}
                      style={styles.avatar}
                    />
                    <View style={styles.contactDetails}>
                      <Text style={styles.contactName}>
                        {message.notifyName || message.from || 'Contacto Desconocido'}
                      </Text>
                      <Text style={styles.contactNumber}>
                        {message.from}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.messageTime}>
                    <Text style={styles.timeText}>
                      {formatTime(message.timestamp)}
                    </Text>
                    <Text style={styles.dateText}>
                      {formatDate(message.timestamp)}
                    </Text>
                  </View>
                </View>

                <View style={styles.messageContent}>
                  <Text style={styles.messageText} numberOfLines={3}>
                    {message.body || 'Mensaje multimedia'}
                  </Text>
                  
                  {message.hasMedia && (
                    <View style={styles.mediaIndicator}>
                      <Icon name="attachment" size={16} color="#6b7280" />
                      <Text style={styles.mediaText}>Archivo adjunto</Text>
                    </View>
                  )}
                </View>

                <View style={styles.messageFooter}>
                  <Chip
                    mode="outlined"
                    style={styles.statusChip}
                    textStyle={styles.statusText}
                  >
                    {message.isFromMe ? 'Enviado' : 'Recibido'}
                  </Chip>
                  
                  {message.type && message.type !== 'chat' && (
                    <Chip
                      mode="outlined"
                      style={styles.typeChip}
                      textStyle={styles.typeText}
                    >
                      {message.type}
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Surface style={styles.emptyState}>
            <Icon name="message" size={64} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No se encontraron mensajes' : 'No hay mensajes disponibles'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? 'Prueba con otros términos de búsqueda'
                : 'Los mensajes aparecerán aquí cuando WhatsApp esté conectado y autenticado'
              }
            </Text>
            {!searchQuery && (
              <Button
                mode="outlined"
                onPress={onRefresh}
                style={styles.emptyStateButton}
              >
                Actualizar
              </Button>
            )}
          </Surface>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  accountsContainer: {
    marginVertical: 8,
  },
  accountChip: {
    marginRight: 8,
  },
  searchbar: {
    marginVertical: 12,
  },
  convertButton: {
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  messageCard: {
    margin: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    backgroundColor: '#10b981',
    marginRight: 12,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  contactNumber: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageTime: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  dateText: {
    fontSize: 10,
    color: '#9ca3af',
  },
  messageContent: {
    marginBottom: 12,
  },
  messageText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  mediaIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  mediaText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusChip: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
  },
  statusText: {
    color: '#0ea5e9',
    fontSize: 11,
  },
  typeChip: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  typeText: {
    color: '#f59e0b',
    fontSize: 11,
  },
  emptyState: {
    margin: 32,
    padding: 32,
    alignItems: 'center',
    borderRadius: 12,
    elevation: 1,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginVertical: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyStateButton: {
    marginTop: 8,
  },
});