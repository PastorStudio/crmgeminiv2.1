import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  FileText, 
  Trash2, 
  Users, 
  Database,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";

interface ContactData {
  id: number;
  numero?: number;
  nombre_pila?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  telefono?: string;
  genero?: string;
  grupo_edad?: string;
  militante?: string;
  nivel_socioeconomico?: string;
  lugar_trabajo?: string;
  escolaridad?: string;
  ano_nacimiento?: number;
  tipo_contratacion?: string;
  uploaded_by?: number;
  file_name?: string;
  uploaded_at?: string;
  created_at?: string;
}

export default function ContactsDatabase() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contacts from database
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["/api/contacts-database"],
    refetchInterval: 30000,
  });

  const contacts = contactsData?.contacts || [];
  const totalContacts = contactsData?.total || 0;

  // Upload contacts mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ contacts, fileName }: { contacts: any[], fileName: string }) => {
      return apiRequest("/api/contacts-database/upload", {
        method: "POST",
        body: { contacts, fileName },
      });
    },
    onSuccess: (data) => {
      setUploadStatus('success');
      setUploadMessage(`Se importaron ${data.imported} contactos exitosamente`);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts-database"] });
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: "Importación exitosa",
        description: `Se importaron ${data.imported} contactos`,
      });
    },
    onError: (error: any) => {
      setUploadStatus('error');
      setUploadMessage(error.message || 'Error al procesar el archivo');
      toast({
        title: "Error en importación",
        description: "Error al procesar el archivo de contactos",
        variant: "destructive",
      });
    },
  });

  // Delete contact mutation
  const deleteMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return apiRequest(`/api/contacts-database/${contactId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts-database"] });
      toast({
        title: "Contacto eliminado",
        description: "El contacto se eliminó exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al eliminar el contacto",
        variant: "destructive",
      });
    },
  });

  // Clear all contacts mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/contacts-database/clear-all", {
        method: "DELETE",
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts-database"] });
      toast({
        title: "Base de datos limpiada",
        description: `Se eliminaron ${data.deleted} contactos`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Error al limpiar la base de datos",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        setSelectedFile(file);
        setUploadStatus('idle');
        setUploadMessage('');
      } else {
        toast({
          title: "Archivo no válido",
          description: "Por favor selecciona un archivo CSV o Excel (.xlsx, .xls)",
          variant: "destructive",
        });
      }
    }
  };

  const processFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let workbook: XLSX.WorkBook;
          
          if (file.name.endsWith('.csv')) {
            workbook = XLSX.read(data, { type: 'binary' });
          } else {
            workbook = XLSX.read(data, { type: 'array' });
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      
      if (file.name.endsWith('.csv')) {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploadStatus('processing');
    setUploadMessage('Procesando archivo...');
    
    try {
      const contacts = await processFile(selectedFile);
      
      if (contacts.length === 0) {
        throw new Error('El archivo está vacío o no contiene datos válidos');
      }
      
      await uploadMutation.mutateAsync({
        contacts,
        fileName: selectedFile.name
      });
    } catch (error: any) {
      setUploadStatus('error');
      setUploadMessage(error.message || 'Error al procesar el archivo');
    }
  };

  const handleDeleteContact = (contactId: number) => {
    if (confirm('¿Estás seguro de que quieres eliminar este contacto?')) {
      deleteMutation.mutate(contactId);
    }
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los contactos? Esta acción no se puede deshacer.')) {
      clearAllMutation.mutate();
    }
  };

  const formatDisplayName = (contact: ContactData) => {
    const parts = [contact.nombre_pila, contact.apellido_paterno, contact.apellido_materno].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : 'Sin nombre';
  };

  const exportToExcel = () => {
    if (contacts.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay contactos para exportar",
        variant: "destructive",
      });
      return;
    }

    const exportData = contacts.map((contact: ContactData) => ({
      '#': contact.numero || '',
      'Nombre de Pila': contact.nombre_pila || '',
      'Ap. Paterno': contact.apellido_paterno || '',
      'Ap. Materno': contact.apellido_materno || '',
      'Telefono': contact.telefono || '',
      'Género': contact.genero || '',
      'Grupo de edad': contact.grupo_edad || '',
      'Militante': contact.militante || '',
      'Nivel Socioeconómico': contact.nivel_socioeconomico || '',
      'Lugar de trabajo': contact.lugar_trabajo || '',
      'Escolaridad': contact.escolaridad || '',
      'Año de nacimiento': contact.ano_nacimiento || '',
      'Tipo de contratación': contact.tipo_contratacion || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contactos");
    XLSX.writeFile(wb, `contactos_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Exportación exitosa",
      description: "Los contactos se exportaron correctamente",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Base de Datos de Contactos</h1>
          <p className="text-muted-foreground">
            Gestiona tu base de datos de contactos con importación y exportación de archivos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {totalContacts} contactos
          </Badge>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Contactos
          </CardTitle>
          <CardDescription>
            Sube archivos CSV o Excel (.xlsx, .xls) con la información de contactos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={uploadStatus === 'processing'}
            />
          </div>
          
          {selectedFile && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {uploadMessage && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              uploadStatus === 'success' ? 'bg-green-50 text-green-700' :
              uploadStatus === 'error' ? 'bg-red-50 text-red-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {uploadStatus === 'success' && <CheckCircle className="h-4 w-4" />}
              {uploadStatus === 'error' && <AlertTriangle className="h-4 w-4" />}
              {uploadStatus === 'processing' && <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              <span className="text-sm">{uploadMessage}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleUpload}
              disabled={!selectedFile || uploadStatus === 'processing'}
              className="flex items-center gap-2"
            >
              <Upload className="h-4 w-4" />
              {uploadStatus === 'processing' ? 'Procesando...' : 'Importar Contactos'}
            </Button>
            
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={totalContacts === 0}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Excel
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={totalContacts === 0 || clearAllMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar Todo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Contactos Almacenados
          </CardTitle>
          <CardDescription>
            Lista de todos los contactos en la base de datos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay contactos en la base de datos</p>
              <p className="text-sm">Importa un archivo para comenzar</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact: ContactData) => (
                  <div key={contact.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium">{formatDisplayName(contact)}</h4>
                        {contact.telefono && (
                          <p className="text-sm text-muted-foreground">📞 {contact.telefono}</p>
                        )}
                        {contact.genero && (
                          <Badge variant="outline" className="text-xs">
                            {contact.genero}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(contact.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {contact.lugar_trabajo && (
                        <p>🏢 {contact.lugar_trabajo}</p>
                      )}
                      {contact.escolaridad && (
                        <p>🎓 {contact.escolaridad}</p>
                      )}
                      {contact.ano_nacimiento && (
                        <p>📅 {contact.ano_nacimiento}</p>
                      )}
                      {contact.file_name && (
                        <p className="italic">📁 {contact.file_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}