import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
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
  TextInput,
  FAB,
} from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ApiService from '../services/ApiService';

export default function TemplatesScreen() {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    content: '',
    category: '',
    variables: []
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, templates]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templatesData = await ApiService.getMessageTemplates();
      setTemplates(templatesData || []);
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las plantillas');
      console.error('Templates loading error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTemplates();
    setRefreshing(false);
  };

  const filterTemplates = () => {
    let filtered = templates;

    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.category?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: '',
      content: '',
      category: '',
      variables: []
    });
    setModalVisible(true);
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || '',
      content: template.content || '',
      category: template.category || '',
      variables: template.variables || []
    });
    setModalVisible(true);
  };

  const saveTemplate = async () => {
    try {
      if (!templateForm.name || !templateForm.content) {
        Alert.alert('Error', 'El nombre y contenido son obligatorios');
        return;
      }

      if (editingTemplate) {
        await ApiService.updateMessageTemplate(editingTemplate.id, templateForm);
        Alert.alert('Éxito', 'Plantilla actualizada correctamente');
      } else {
        await ApiService.createMessageTemplate(templateForm);
        Alert.alert('Éxito', 'Plantilla creada correctamente');
      }

      setModalVisible(false);
      await loadTemplates();
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la plantilla');
    }
  };

  const deleteTemplate = async (templateId) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que quieres eliminar esta plantilla?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.deleteMessageTemplate(templateId);
              Alert.alert('Éxito', 'Plantilla eliminada correctamente');
              await loadTemplates();
            } catch (error) {
              Alert.alert('Error', 'No se pudo eliminar la plantilla');
            }
          }
        }
      ]
    );
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'saludo': return '#3b82f6';
      case 'seguimiento': return '#10b981';
      case 'promocion': return '#f59e0b';
      case 'cierre': return '#ef4444';
      case 'soporte': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const extractVariables = (content) => {
    const matches = content.match(/\{\{([^}]+)\}\}/g);
    return matches ? matches.map(match => match.replace(/[{}]/g, '')) : [];
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>Cargando plantillas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Title>Plantillas de Mensajes</Title>
        
        <Searchbar
          placeholder="Buscar plantillas..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
      </View>

      {/* Templates List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredTemplates.length > 0 ? (
          filteredTemplates.map((template, index) => (
            <Card key={index} style={styles.templateCard}>
              <Card.Content>
                <View style={styles.templateHeader}>
                  <View style={styles.templateInfo}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    {template.category && (
                      <Chip
                        mode="outlined"
                        style={{
                          backgroundColor: getCategoryColor(template.category) + '20',
                          borderColor: getCategoryColor(template.category),
                          marginTop: 4,
                          alignSelf: 'flex-start'
                        }}
                        textStyle={{
                          color: getCategoryColor(template.category),
                          fontSize: 12
                        }}
                      >
                        {template.category}
                      </Chip>
                    )}
                  </View>

                  <View style={styles.templateActions}>
                    <Button
                      mode="outlined"
                      onPress={() => openEditModal(template)}
                      style={styles.actionButton}
                      compact
                    >
                      <Icon name="edit" size={16} />
                    </Button>
                    
                    <Button
                      mode="outlined"
                      onPress={() => deleteTemplate(template.id)}
                      style={[styles.actionButton, styles.deleteButton]}
                      compact
                    >
                      <Icon name="delete" size={16} color="#ef4444" />
                    </Button>
                  </View>
                </View>

                <Text style={styles.templateContent} numberOfLines={3}>
                  {template.content}
                </Text>

                {template.variables && template.variables.length > 0 && (
                  <View style={styles.variablesSection}>
                    <Text style={styles.variablesLabel}>Variables:</Text>
                    <View style={styles.variablesList}>
                      {template.variables.map((variable, idx) => (
                        <Chip
                          key={idx}
                          mode="outlined"
                          style={styles.variableChip}
                          textStyle={styles.variableText}
                        >
                          {variable}
                        </Chip>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.templateFooter}>
                  <Text style={styles.templateMeta}>
                    Creada: {new Date(template.createdAt).toLocaleDateString('es-ES')}
                  </Text>
                  <Text style={styles.templateLength}>
                    {template.content?.length || 0} caracteres
                  </Text>
                </View>
              </Card.Content>
            </Card>
          ))
        ) : (
          <Surface style={styles.emptyState}>
            <Icon name="text-snippet" size={64} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>
              {searchQuery ? 'No se encontraron plantillas' : 'No hay plantillas disponibles'}
            </Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? 'Prueba con otros términos de búsqueda'
                : 'Crea tu primera plantilla de mensaje para agilizar tus conversaciones'
              }
            </Text>
            {!searchQuery && (
              <Button
                mode="contained"
                onPress={openCreateModal}
                style={styles.emptyStateButton}
                buttonColor="#10b981"
              >
                Crear Primera Plantilla
              </Button>
            )}
          </Surface>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        style={styles.fab}
        icon="add"
        onPress={openCreateModal}
        color="#ffffff"
      />

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Title>{editingTemplate ? 'Editar Plantilla' : 'Crear Plantilla'}</Title>
            <Button
              mode="text"
              onPress={() => setModalVisible(false)}
              icon="close"
            />
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              label="Nombre de la plantilla"
              value={templateForm.name}
              onChangeText={(text) => setTemplateForm({...templateForm, name: text})}
              style={styles.formInput}
              mode="outlined"
            />

            <TextInput
              label="Categoría"
              value={templateForm.category}
              onChangeText={(text) => setTemplateForm({...templateForm, category: text})}
              style={styles.formInput}
              mode="outlined"
              placeholder="ej: Saludo, Seguimiento, Promoción"
            />

            <TextInput
              label="Contenido del mensaje"
              value={templateForm.content}
              onChangeText={(text) => {
                setTemplateForm({
                  ...templateForm, 
                  content: text,
                  variables: extractVariables(text)
                });
              }}
              style={styles.formInput}
              mode="outlined"
              multiline
              numberOfLines={6}
              placeholder="Escribe tu mensaje aquí. Usa {{variable}} para campos dinámicos"
            />

            {templateForm.variables.length > 0 && (
              <View style={styles.variablesPreview}>
                <Text style={styles.variablesPreviewLabel}>Variables detectadas:</Text>
                <View style={styles.variablesList}>
                  {templateForm.variables.map((variable, idx) => (
                    <Chip
                      key={idx}
                      mode="outlined"
                      style={styles.variableChip}
                      textStyle={styles.variableText}
                    >
                      {variable}
                    </Chip>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setModalVisible(false)}
              style={styles.modalActionButton}
            >
              Cancelar
            </Button>
            <Button
              mode="contained"
              onPress={saveTemplate}
              style={styles.modalActionButton}
              buttonColor="#10b981"
            >
              {editingTemplate ? 'Actualizar' : 'Crear'}
            </Button>
          </View>
        </View>
      </Modal>
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
    marginTop: 12,
  },
  scrollView: {
    flex: 1,
  },
  templateCard: {
    margin: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  templateInfo: {
    flex: 1,
    marginRight: 12,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  templateActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    minWidth: 40,
  },
  deleteButton: {
    borderColor: '#ef4444',
  },
  templateContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  variablesSection: {
    marginBottom: 12,
  },
  variablesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  variablesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  variableChip: {
    backgroundColor: '#f0f9ff',
    borderColor: '#0ea5e9',
  },
  variableText: {
    color: '#0ea5e9',
    fontSize: 11,
  },
  templateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  templateMeta: {
    fontSize: 12,
    color: '#6b7280',
  },
  templateLength: {
    fontSize: 12,
    color: '#9ca3af',
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
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#10b981',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formInput: {
    marginBottom: 16,
  },
  variablesPreview: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#0ea5e9',
  },
  variablesPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0ea5e9',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalActionButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});