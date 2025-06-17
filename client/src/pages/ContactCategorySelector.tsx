import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { 
  Database, 
  MessageSquare, 
  Users, 
  Filter,
  CheckCircle,
  Phone,
  User,
  Download,
  Upload,
  Send
} from "lucide-react";

interface DatabaseContact {
  id: number;
  nombre: string;
  telefono: string;
  genero?: string;
  nivelSocioeconomico?: string;
  anoNacimiento?: string;
  tipoContratacion?: string;
  grupoEdad?: string;
  militante?: string;
  escolaridad?: string;
}

interface WhatsAppContact {
  id: string;
  name?: string;
  phoneNumber: string;
  tags?: string[];
}

export default function ContactCategorySelector() {
  const [activeTab, setActiveTab] = useState<'database' | 'whatsapp'>('database');
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  // Consulta para contactos de la base de datos
  const { data: databaseResponse = {}, isLoading: loadingDatabase } = useQuery({
    queryKey: ['/api/contact-database'],
    select: (data: any) => data || {}
  });

  const databaseContacts: DatabaseContact[] = databaseResponse.contacts || [];

  // Consulta para contactos de WhatsApp
  const { data: whatsappContacts = [], isLoading: loadingWhatsApp } = useQuery<WhatsAppContact[]>({
    queryKey: ['/api/whatsapp/contacts'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Filtrar contactos de la base de datos por categoría
  const filteredDatabaseContacts = React.useMemo(() => {
    if (selectedFilter === 'none' || !selectedCategory) {
      return databaseContacts;
    }

    return databaseContacts.filter(contact => {
      switch (selectedFilter) {
        case 'genero':
          return contact.genero?.toLowerCase() === selectedCategory.toLowerCase();
        case 'nivel_socioeconomico':
          return contact.nivelSocioeconomico?.toLowerCase() === selectedCategory.toLowerCase();
        case 'grupo_edad':
          return contact.grupoEdad?.toLowerCase() === selectedCategory.toLowerCase();
        case 'tipo_contratacion':
          return contact.tipoContratacion?.toLowerCase() === selectedCategory.toLowerCase();
        case 'militante':
          return contact.militante?.toLowerCase() === selectedCategory.toLowerCase();
        case 'escolaridad':
          return contact.escolaridad?.toLowerCase() === selectedCategory.toLowerCase();
        default:
          return true;
      }
    });
  }, [databaseContacts, selectedFilter, selectedCategory]);

  // Obtener categorías únicas para el filtro seleccionado
  const availableCategories = React.useMemo(() => {
    if (selectedFilter === 'none') return [];
    
    const categories = new Set<string>();
    databaseContacts.forEach(contact => {
      let value: string | undefined;
      switch (selectedFilter) {
        case 'genero':
          value = contact.genero;
          break;
        case 'nivel_socioeconomico':
          value = contact.nivelSocioeconomico;
          break;
        case 'grupo_edad':
          value = contact.grupoEdad;
          break;
        case 'tipo_contratacion':
          value = contact.tipoContratacion;
          break;
        case 'militante':
          value = contact.militante;
          break;
        case 'escolaridad':
          value = contact.escolaridad;
          break;
      }
      if (value && value.trim()) {
        categories.add(value);
      }
    });
    
    return Array.from(categories).sort();
  }, [databaseContacts, selectedFilter]);

  // Manejar selección de contacto individual
  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // Seleccionar todos los contactos filtrados
  const handleSelectAll = () => {
    const contactsToUse = activeTab === 'database' ? filteredDatabaseContacts : whatsappContacts;
    const allIds = contactsToUse.map(contact => 
      activeTab === 'database' ? contact.id.toString() : contact.id
    );
    setSelectedContacts(allIds);
  };

  // Deseleccionar todos
  const handleDeselectAll = () => {
    setSelectedContacts([]);
  };

  // Exportar contactos seleccionados
  const handleExportSelected = () => {
    const contactsToUse = activeTab === 'database' ? filteredDatabaseContacts : whatsappContacts;
    const selectedContactsData = contactsToUse.filter(contact =>
      selectedContacts.includes(
        activeTab === 'database' ? contact.id.toString() : contact.id
      )
    );

    if (selectedContactsData.length === 0) {
      toast({
        title: "Sin selección",
        description: "No hay contactos seleccionados para exportar",
        variant: "destructive"
      });
      return;
    }

    // Preparar datos para CSV
    let csvContent = "";
    let headers = "";
    
    if (activeTab === 'database') {
      headers = "ID,Nombre,Teléfono,Género,Nivel Socioeconómico,Año Nacimiento,Tipo Contratación,Grupo Edad,Militante,Escolaridad\n";
      csvContent = selectedContactsData.map((contact: DatabaseContact) => 
        `${contact.id},"${contact.nombre}","${contact.telefono}","${contact.genero || ''}","${contact.nivelSocioeconomico || ''}","${contact.anoNacimiento || ''}","${contact.tipoContratacion || ''}","${contact.grupoEdad || ''}","${contact.militante || ''}","${contact.escolaridad || ''}"`
      ).join('\n');
    } else {
      headers = "ID,Nombre,Teléfono,Etiquetas\n";
      csvContent = selectedContactsData.map((contact: WhatsAppContact) => 
        `"${contact.id}","${contact.name || 'Sin nombre'}","${contact.phoneNumber}","${contact.tags?.join(';') || ''}"`
      ).join('\n');
    }

    const finalCsv = headers + csvContent;
    const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `contactos_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    toast({
      title: "Exportación exitosa",
      description: `${selectedContactsData.length} contactos exportados desde ${activeTab === 'database' ? 'base de datos' : 'WhatsApp'}`
    });
  };

  // Enviar a plataforma de mensajería
  const handleSendToMessaging = () => {
    const contactsToUse = activeTab === 'database' ? filteredDatabaseContacts : whatsappContacts;
    const selectedContactsData = contactsToUse.filter(contact =>
      selectedContacts.includes(
        activeTab === 'database' ? contact.id.toString() : contact.id
      )
    );

    if (selectedContactsData.length === 0) {
      toast({
        title: "Sin selección",
        description: "No hay contactos seleccionados para enviar",
        variant: "destructive"
      });
      return;
    }

    // Almacenar en localStorage para usar en envío masivo
    localStorage.setItem('selectedCategoryContacts', JSON.stringify({
      contacts: selectedContactsData,
      source: activeTab,
      timestamp: new Date().toISOString()
    }));

    toast({
      title: "Contactos preparados",
      description: `${selectedContactsData.length} contactos listos para envío masivo. Ve a la página de Envío Masivo para continuar.`
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Selector de Contactos por Categorías</h1>
          <p className="text-muted-foreground">
            Filtra y selecciona contactos de WhatsApp o de la base de datos por categorías específicas
          </p>
        </div>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Fuentes de Contactos
          </CardTitle>
          <CardDescription>
            Elige entre contactos de WhatsApp o de la base de datos, y aplica filtros por categorías
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => {
            setActiveTab(value as 'database' | 'whatsapp');
            setSelectedContacts([]);
            setSelectedFilter('none');
            setSelectedCategory('');
          }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="database" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Base de Datos ({databaseContacts.length})
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                WhatsApp ({whatsappContacts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="database" className="space-y-4">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Filtrar por:</label>
                  <Select value={selectedFilter} onValueChange={(value) => {
                    setSelectedFilter(value);
                    setSelectedCategory('');
                    setSelectedContacts([]);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar filtro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin filtro</SelectItem>
                      <SelectItem value="genero">Género</SelectItem>
                      <SelectItem value="nivel_socioeconomico">Nivel Socioeconómico</SelectItem>
                      <SelectItem value="grupo_edad">Grupo de Edad</SelectItem>
                      <SelectItem value="tipo_contratacion">Tipo de Contratación</SelectItem>
                      <SelectItem value="militante">Militante</SelectItem>
                      <SelectItem value="escolaridad">Escolaridad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {selectedFilter !== 'none' && availableCategories.length > 0 && (
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Categoría:</label>
                    <Select value={selectedCategory} onValueChange={(value) => {
                      setSelectedCategory(value);
                      setSelectedContacts([]);
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCategories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Seleccionar Todos ({filteredDatabaseContacts.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deseleccionar Todos
                  </Button>
                </div>
                <Badge variant="secondary">
                  {selectedContacts.length} seleccionados
                </Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Género</TableHead>
                      <TableHead>Nivel Socioeconómico</TableHead>
                      <TableHead>Grupo Edad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDatabaseContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.includes(contact.id.toString())}
                            onCheckedChange={() => handleContactToggle(contact.id.toString())}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.nombre}</TableCell>
                        <TableCell>{contact.telefono}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.genero || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.nivelSocioeconomico || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{contact.grupoEdad || 'N/A'}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    Seleccionar Todos ({whatsappContacts.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                    Deseleccionar Todos
                  </Button>
                </div>
                <Badge variant="secondary">
                  {selectedContacts.length} seleccionados
                </Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Etiquetas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {whatsappContacts.map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => handleContactToggle(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            {contact.name || 'Sin nombre'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-gray-500" />
                            {contact.phoneNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags?.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            )) || <span className="text-gray-500 text-sm">Sin etiquetas</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between gap-4 mt-6">
            <Button 
              variant="outline"
              onClick={handleExportSelected}
              disabled={selectedContacts.length === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Seleccionados ({selectedContacts.length})
            </Button>
            
            <Button 
              onClick={handleSendToMessaging}
              disabled={selectedContacts.length === 0}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Enviar a Mensajería Masiva ({selectedContacts.length})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}