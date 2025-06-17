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
import { 
  Database, 
  MessageSquare, 
  Users, 
  Filter,
  CheckCircle,
  Phone,
  User
} from "lucide-react";

interface ContactCategorySelectorProps {
  onContactsSelected: (contacts: any[], source: 'whatsapp' | 'database') => void;
  selectedContacts?: string[];
}

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

export function ContactCategorySelector({ onContactsSelected, selectedContacts = [] }: ContactCategorySelectorProps) {
  const [activeTab, setActiveTab] = useState<'database' | 'whatsapp'>('database');
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [localSelectedContacts, setLocalSelectedContacts] = useState<string[]>(selectedContacts);

  // Consulta para contactos de la base de datos
  const { data: databaseContacts = [], isLoading: loadingDatabase } = useQuery<DatabaseContact[]>({
    queryKey: ['/api/contact-database'],
    select: (data: any) => data?.contacts || []
  });

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
    const updatedSelection = localSelectedContacts.includes(contactId)
      ? localSelectedContacts.filter(id => id !== contactId)
      : [...localSelectedContacts, contactId];
    
    setLocalSelectedContacts(updatedSelection);
  };

  // Seleccionar todos los contactos filtrados
  const handleSelectAll = () => {
    const contactsToUse = activeTab === 'database' ? filteredDatabaseContacts : whatsappContacts;
    const allIds = contactsToUse.map(contact => 
      activeTab === 'database' ? contact.id.toString() : contact.id
    );
    setLocalSelectedContacts(allIds);
  };

  // Deseleccionar todos
  const handleDeselectAll = () => {
    setLocalSelectedContacts([]);
  };

  // Confirmar selección
  const handleConfirmSelection = () => {
    const contactsToUse = activeTab === 'database' ? filteredDatabaseContacts : whatsappContacts;
    const selectedContactsData = contactsToUse.filter(contact =>
      localSelectedContacts.includes(
        activeTab === 'database' ? contact.id.toString() : contact.id
      )
    );
    
    onContactsSelected(selectedContactsData, activeTab);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Selector de Contactos por Categorías
        </CardTitle>
        <CardDescription>
          Selecciona contactos de WhatsApp o de la base de datos filtrados por categorías específicas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'database' | 'whatsapp')}>
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
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
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
              
              {selectedFilter !== 'none' && (
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Categoría:</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
                {localSelectedContacts.length} seleccionados
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
                          checked={localSelectedContacts.includes(contact.id.toString())}
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
                {localSelectedContacts.length} seleccionados
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
                          checked={localSelectedContacts.includes(contact.id)}
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

        <div className="flex justify-end gap-2 mt-4">
          <Button 
            onClick={handleConfirmSelection}
            disabled={localSelectedContacts.length === 0}
            className="flex items-center gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Usar Contactos Seleccionados ({localSelectedContacts.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}