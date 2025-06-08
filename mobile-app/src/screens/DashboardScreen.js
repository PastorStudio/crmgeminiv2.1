import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  Surface,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { LineChart, PieChart } from 'react-native-chart-kit';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/ApiService';

const screenWidth = Dimensions.get('window').width;

export default function DashboardScreen() {
  const [stats, setStats] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load dashboard stats
      const dashboardStats = await ApiService.getDashboardStats();
      setStats(dashboardStats);

      // Load WhatsApp status
      const whatsappData = await ApiService.getWhatsAppAccounts();
      setWhatsappStatus(whatsappData);

      // Load recent leads
      const leadsData = await ApiService.getLeads();
      setRecentLeads(leadsData.slice(0, 5)); // Get latest 5 leads

    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los datos del dashboard');
      console.error('Dashboard loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const convertChatsToLeads = async () => {
    try {
      const result = await ApiService.convertWhatsAppChatsToLeads();
      Alert.alert(
        'Conversión Exitosa', 
        `${result.leadsCreated} nuevos leads creados desde conversaciones reales`
      );
      await loadDashboardData(); // Refresh data
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando dashboard...</Text>
      </View>
    );
  }

  const pieData = [
    {
      name: 'Nuevos',
      population: stats?.newLeads || 0,
      color: '#3b82f6',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'Calificados',
      population: stats?.qualifiedLeads || 0,
      color: '#10b981',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
    {
      name: 'Ganados',
      population: stats?.closedWon || 0,
      color: '#22c55e',
      legendFontColor: '#7F7F7F',
      legendFontSize: 12,
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header Stats */}
      <View style={styles.statsContainer}>
        <Surface style={styles.statCard}>
          <Icon name="people" size={24} color="#3b82f6" />
          <Text style={styles.statNumber}>{stats?.totalLeads || 0}</Text>
          <Text style={styles.statLabel}>Total Leads</Text>
        </Surface>

        <Surface style={styles.statCard}>
          <Icon name="trending-up" size={24} color="#10b981" />
          <Text style={styles.statNumber}>{formatCurrency(stats?.totalRevenue || 0)}</Text>
          <Text style={styles.statLabel}>Ingresos Potenciales</Text>
        </Surface>

        <Surface style={styles.statCard}>
          <Icon name="percent" size={24} color="#f59e0b" />
          <Text style={styles.statNumber}>{stats?.conversionRate || 0}%</Text>
          <Text style={styles.statLabel}>Conversión</Text>
        </Surface>
      </View>

      {/* WhatsApp Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Estado WhatsApp</Title>
          {whatsappStatus?.accounts?.map((account, index) => (
            <View key={index} style={styles.whatsappStatus}>
              <View style={styles.statusRow}>
                <Text style={styles.accountName}>{account.name || 'Cuenta WhatsApp'}</Text>
                <Chip 
                  mode="outlined" 
                  style={{
                    backgroundColor: account.status === 'Conectado' ? '#dcfce7' : '#fee2e2'
                  }}
                  textStyle={{
                    color: account.status === 'Conectado' ? '#16a34a' : '#dc2626'
                  }}
                >
                  {account.status || 'Desconectado'}
                </Chip>
              </View>
              {account.autoResponseEnabled && (
                <Text style={styles.autoResponseText}>
                  ✓ Respuestas automáticas activas
                </Text>
              )}
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Leads Distribution Chart */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Distribución de Leads</Title>
          {pieData.some(item => item.population > 0) ? (
            <PieChart
              data={pieData}
              width={screenWidth - 60}
              height={200}
              chartConfig={{
                backgroundColor: '#ffffff',
                backgroundGradientFrom: '#ffffff',
                backgroundGradientTo: '#ffffff',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          ) : (
            <Text style={styles.noDataText}>No hay datos de leads disponibles</Text>
          )}
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Acciones Rápidas</Title>
          <View style={styles.actionsContainer}>
            <Button
              mode="contained"
              icon="message"
              onPress={convertChatsToLeads}
              style={styles.actionButton}
              buttonColor="#10b981"
            >
              Convertir Chats a Leads
            </Button>
            <Button
              mode="outlined"
              icon="refresh"
              onPress={onRefresh}
              style={styles.actionButton}
            >
              Actualizar Datos
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Leads */}
      <Card style={styles.card}>
        <Card.Content>
          <Title>Leads Recientes</Title>
          {recentLeads.length > 0 ? (
            recentLeads.map((lead, index) => (
              <Surface key={index} style={styles.leadItem}>
                <View style={styles.leadHeader}>
                  <Text style={styles.leadName}>{lead.fullName || lead.name}</Text>
                  <Chip 
                    mode="outlined" 
                    style={{ backgroundColor: getStatusColor(lead.status) + '20' }}
                    textStyle={{ color: getStatusColor(lead.status) }}
                  >
                    {lead.status}
                  </Chip>
                </View>
                <Text style={styles.leadCompany}>{lead.company}</Text>
                <Text style={styles.leadValue}>
                  {formatCurrency(lead.value || 0)}
                </Text>
              </Surface>
            ))
          ) : (
            <Text style={styles.noDataText}>No hay leads recientes</Text>
          )}
        </Card.Content>
      </Card>
    </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
  card: {
    margin: 16,
    borderRadius: 12,
    elevation: 2,
  },
  whatsappStatus: {
    marginVertical: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accountName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  autoResponseText: {
    fontSize: 14,
    color: '#10b981',
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  leadItem: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    elevation: 1,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
  },
  leadCompany: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  leadValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10b981',
    marginTop: 4,
  },
  noDataText: {
    textAlign: 'center',
    color: '#6b7280',
    fontStyle: 'italic',
    marginVertical: 20,
  },
});