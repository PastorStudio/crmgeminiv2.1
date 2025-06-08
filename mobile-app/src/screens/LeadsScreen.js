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
  Menu,
  Divider,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/ApiService';

export default function LeadsScreen() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [searchQuery, filterStatus, leads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const leadsData = await ApiService.getLeads();
      setLeads(leadsData);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los leads');
      console.error('Leads loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeads();
    setRefreshing(false);
  };

  const filterLeads = () => {
    let filtered = leads;

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(lead =>
        (lead.fullName || lead.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.company || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (lead.email || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    setFilteredLeads(filtered);
  };

  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      await ApiService.updateLeadStatus(leadId, newStatus);
      await loadLeads();
      Alert.alert('Éxito', `Lead actualizado a ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo actualizar el lead');
    }
  };

  const convertChatsToLeads = async () => {
    try {
      const result = await ApiService.convertWhatsAppChatsToLeads();
      Alert.alert(
        'Conversión Exitosa',
        `${result.leadsCreated} nuevos leads creados desde conversaciones reales`
      );
      await loadLeads();
    } catch (error) {
      Alert.alert('Error', 'No se pudieron convertir los chats a leads');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return '#3b82f6';
      case 'qualified': return '#10b981';
      case 'proposal': return '#f59e0b';
      case 'negotiation': return '#ef4444';
      case 'closed-won': return '#22c55e';
      case 'closed-lost': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getStatusDisplayName = (status) => {
    switch (status) {
      case 'new': return 'Nuevo';
      case 'qualified': return 'Calificado';
      case 'proposal': return 'Propuesta';
      case 'negotiation': return 'Negociación';
      case 'closed-won': return 'Ganado';
      case 'closed-lost': return 'Perdido';
      default: return status;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const isRealConversationLead = (lead) => {
    return lead.customFields?.isRealConversation === true;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando leads...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with search and filters */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Buscar leads..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        
        <View style={styles.headerActions}>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                onPress={() => setMenuVisible(true)}
                icon="filter-list"
                style={styles.filterButton}
              >
                Filtrar
              </Button>
            }
          >
            <Menu.Item onPress={() => { setFilterStatus('all'); setMenuVisible(false); }} title="Todos" />
            <Menu.Item onPress={() => { setFilterStatus('new'); setMenuVisible(false); }} title="Nuevos" />
            <Menu.Item onPress={() => { setFilterStatus('qualified'); setMenuVisible(false); }} title="Calificados" />
            <Menu.Item onPress={() => { setFilterStatus('proposal'); setMenuVisible(false); }} title="Propuesta" />
            <Menu.Item onPress={() => { setFilterStatus('negotiation'); setMenuVisible(false); }} title="Negociación" />
            <Menu.Item onPress={() => { setFilterStatus('closed-won'); setMenuVisible(false); }} title="Ganados" />
          </Menu>

          <Button
            mode="contained"
            onPress={convertChatsToLeads}
            icon="message"
            style={styles.convertButton}
            buttonColor="#10b981"
          >
            Convertir Chats
          </Button>
        </View>
      </View>

      {/* Leads List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredLeads.length > 0 ? (
          filteredLeads.map((lead, index) => (
            <Card key={index} style={styles.leadCard}>
              <Card.Content>
                <View style={styles.leadHeader}>
                  <View style={styles.leadInfo}>
                    <View style={styles.leadTitleRow}>
                      <Text style={styles.leadName}>
                        {lead.fullName || lead.name}
                      </Text>
                      {isRealConversationLead(lead) && (
                        <Chip
                          mode="outlined"
                          style={styles.realChatChip}
                          textStyle={styles.realChatText}
                          icon="message"
                        >
                          Chat Real ({lead.customFields?.messageCount} msgs)
                        </Chip>
                      )}
                    </View>
                    
                    <Text style={styles.leadCompany}>{lead.company}</Text>
                    <Text style={styles.leadEmail}>{lead.email}</Text>
                    
                    <View style={styles.leadMeta}>
                      <Text style={styles.leadValue}>
                        {formatCurrency(lead.value || 0)}
                      </Text>
                      <Text style={styles.leadSource}>
                        Fuente: {lead.source || 'N/A'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.leadActions}>
                    <Chip
                      mode="outlined"
                      style={{
                        backgroundColor: getStatusColor(lead.status) + '20',
                        marginBottom: 8,
                      }}
                      textStyle={{ color: getStatusColor(lead.status) }}
                    >
                      {getStatusDisplayName(lead.status)}
                    </Chip>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                        onPress={() => updateLeadStatus(lead.id, 'qualified')}
                      >
                        <Icon name="check" size={16} color="#ffffff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
                        onPress={() => updateLeadStatus(lead.id, 'proposal')}
                      >
                        <Icon name="description" size={16} color="#ffffff" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#22c55e' }]}
                        onPress={() => updateLeadStatus(lead.id, 'closed-won')}
                      >
                        <Icon name="monetization-on" size={16} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {lead.notes && (
                  <View style={styles.notesSection}>
                    <Text style={styles.notesLabel}>Notas:</Text>
                    <Text style={styles.notesText} numberOfLines={2}>
                      {lead.notes}
                    </Text>
                  </View>
                )}

                {isRealConversationLead(lead) && lead.customFields?.firstMessage && (
                  <View style={styles.conversationPreview}>
                    <Text style={styles.conversationLabel}>Primer mensaje:</Text>
                    <Text style={styles.conversationText} numberOfLines={2}>
                      "{lead.customFields.firstMessage}"
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>
          ))
        ) : (
          <Surface style={styles.emptyState}>
            <Icon name="people-outline" size={64} color="#6b7280" />
            <Text style={styles.emptyStateText}>
              {searchQuery || filterStatus !== 'all'
                ? 'No se encontraron leads con los filtros aplicados'
                : 'No hay leads disponibles'
              }
            </Text>
            <Button
              mode="contained"
              onPress={convertChatsToLeads}
              style={styles.emptyStateButton}
              buttonColor="#10b981"
            >
              Generar Leads desde WhatsApp
            </Button>
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
  searchbar: {
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterButton: {
    marginRight: 8,
  },
  convertButton: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  leadCard: {
    margin: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leadInfo: {
    flex: 1,
    marginRight: 12,
  },
  leadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  leadName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginRight: 8,
  },
  realChatChip: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
  },
  realChatText: {
    color: '#16a34a',
    fontSize: 10,
  },
  leadCompany: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  leadEmail: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 8,
  },
  leadMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  leadSource: {
    fontSize: 12,
    color: '#6b7280',
  },
  leadActions: {
    alignItems: 'flex-end',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  notesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  conversationPreview: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  conversationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16a34a',
    marginBottom: 2,
  },
  conversationText: {
    fontSize: 13,
    color: '#15803d',
    fontStyle: 'italic',
  },
  emptyState: {
    margin: 32,
    padding: 32,
    alignItems: 'center',
    borderRadius: 12,
    elevation: 1,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 16,
  },
  emptyStateButton: {
    marginTop: 8,
  },
});