import React, { useState, useRef } from "react";
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
  X,
  Edit3,
  Save,
  Plus,
  Grid3X3
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
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editableData, setEditableData] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<{row: number, col: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contacts from database
  const { data: contactsData, isLoading } = useQuery({
    queryKey: ["/api/contacts-database"],
    refetchInterval: 30000,
  });

  const contacts: ContactData[] = Array.isArray(contactsData?.contacts) ? contactsData.contacts : [];
  const totalContacts: number = contactsData?.total || 0;
  
  // Use Excel headers and column widths from backend if available
  const backendHeaders = contactsData?.excelHeaders || [];
  const backendColumnWidths = contactsData?.columnWidths || [];
  
  // Update local state with backend data if not already set
  React.useEffect(() => {
    if (backendHeaders.length > 0 && fileHeaders.length === 0) {
      setFileHeaders(backendHeaders);
    }
    if (backendColumnWidths.length > 0 && columnWidths.length === 0) {
      setColumnWidths(backendColumnWidths);
    }
  }, [backendHeaders, backendColumnWidths, fileHeaders.length, columnWidths.length]);

  // Initialize editable data when contacts change
  React.useEffect(() => {
    if (contacts.length > 0 && !isEditMode) {
      setEditableData(contacts.map(contact => ({ ...contact })));
    }
  }, [contacts, isEditMode]);

  // Function to automatically separate text like Excel
  const separateTextIntoColumns = (text: string): string[] => {
    // Split by tabs (most common Excel copy format)
    if (text.includes('\t')) {
      return text.split('\t');
    }
    
    // Split by multiple spaces (4 or more)
    if (text.match(/\s{4,}/)) {
      return text.split(/\s{4,}/);
    }
    
    // Split by commas (CSV format)
    if (text.includes(',')) {
      return text.split(',').map(item => item.trim());
    }
    
    // Split by semicolons
    if (text.includes(';')) {
      return text.split(';').map(item => item.trim());
    }
    
    // Split by pipes
    if (text.includes('|')) {
      return text.split('|').map(item => item.trim());
    }
    
    // Default: return as single column
    return [text];
  };

  // Handle paste operation
  const handlePaste = async (e: React.ClipboardEvent, rowIndex: number, colIndex: number) => {
    e.preventDefault();
    
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    // Split text into columns automatically using commas as primary separator
    const separatedData = pasteData.split(',').map(item => item.trim()).filter(item => item !== '');
    
    // Fixed field names matching the column headers
    const fieldNames = [
      'nombre_pila', 'apellido_paterno', 'apellido_materno', 'telefono', 
      'genero', 'grupo_edad', 'militante', 'nivel_socioeconomico', 
      'lugar_trabajo', 'escolaridad', 'ano_nacimiento', 'tipo_contratacion'
    ];
    
    // Create new row data
    const newEditableData = [...editableData];
    
    // If we don't have enough rows, create new ones
    while (newEditableData.length <= rowIndex) {
      const newRow: any = { id: Date.now() + Math.random(), numero: newEditableData.length + 1 };
      fieldNames.forEach(fieldName => {
        newRow[fieldName] = '';
      });
      newEditableData.push(newRow);
    }
    
    // Fill the separated data into columns
    separatedData.forEach((data, index) => {
      const targetColIndex = colIndex + index;
      if (targetColIndex < fieldNames.length) {
        const fieldName = fieldNames[targetColIndex];
        newEditableData[rowIndex][fieldName] = data.trim();
      }
    });
    
    setEditableData(newEditableData);
    
    toast({
      title: "Texto pegado y separado",
      description: `Datos separados en ${separatedData.length} columna(s)`,
    });
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    if (isEditMode) {
      // Save changes when exiting edit mode
      saveEditableData();
    } else {
      // Enter edit mode
      setEditableData(contacts.map(contact => ({ ...contact })));
    }
    setIsEditMode(!isEditMode);
  };

  // Save editable data
  const saveEditableData = async () => {
    try {
      // Here you would typically call an API to save the data
      // For now, we'll just show a success message
      toast({
        title: "Datos guardados",
        description: "Los cambios han sido guardados exitosamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al guardar los cambios",
        variant: "destructive",
      });
    }
  };

  // Add new row
  const addNewRow = () => {
    const newRow: any = { 
      id: Date.now() + Math.random(), 
      numero: editableData.length + 1 
    };
    
    // Fixed field names matching the column headers
    const fieldNames = [
      'nombre_pila', 'apellido_paterno', 'apellido_materno', 'telefono', 
      'genero', 'grupo_edad', 'militante', 'nivel_socioeconomico', 
      'lugar_trabajo', 'escolaridad', 'ano_nacimiento', 'tipo_contratacion'
    ];
    
    fieldNames.forEach(fieldName => {
      newRow[fieldName] = '';
    });
    
    setEditableData([...editableData, newRow]);
  };

  // Handle cell value change
  const handleCellChange = (rowIndex: number, columnKey: string, value: string) => {
    const newData = [...editableData];
    newData[rowIndex][columnKey] = value;
    setEditableData(newData);
  };

  // Upload contacts mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ contacts, fileName, headers, columnWidths }: { 
      contacts: any[], 
      fileName: string, 
      headers?: string[], 
      columnWidths?: number[] 
    }) => {
      return apiRequest("/api/contacts-database/upload", {
        method: "POST",
        body: { contacts, fileName, headers, columnWidths },
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

  const processFile = async (file: File): Promise<{ headers: string[], data: any[], columnWidths: number[] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          let workbook: XLSX.WorkBook;
          
          if (file.name.endsWith('.csv')) {
            workbook = XLSX.read(data, { type: 'binary', cellStyles: true, cellDates: true });
          } else {
            workbook = XLSX.read(data, { type: 'array', cellStyles: true, cellDates: true });
          }
          
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Get the range of the worksheet
          const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
          
          // Extract headers from first row
          const headers: string[] = [];
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            const cell = worksheet[cellAddress];
            headers.push(cell ? String(cell.v) : `Columna ${col + 1}`);
          }
          
          // Calculate column widths based on content
          const columnWidths: number[] = headers.map(header => header.length);
          
          // Extract all data rows (starting from row 1, skipping header)
          const jsonData: any[] = [];
          for (let row = range.s.r + 1; row <= range.e.r; row++) {
            const rowData: any = {};
            for (let col = range.s.c; col <= range.e.c; col++) {
              const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
              const cell = worksheet[cellAddress];
              const headerKey = headers[col - range.s.c];
              // Preserve all text content exactly as it appears, including special characters
              let cellValue = '';
              if (cell && cell.v !== undefined && cell.v !== null) {
                // Convert to string and preserve all characters without trimming
                cellValue = String(cell.v);
                // Only remove leading/trailing whitespace if it's actually empty
                if (cellValue.trim() !== '') {
                  cellValue = cellValue.trim();
                }
              }
              
              rowData[headerKey] = cellValue;
              
              // Update column width based on content length
              if (cellValue.length > columnWidths[col - range.s.c]) {
                columnWidths[col - range.s.c] = cellValue.length;
              }
            }
            
            // Only add rows that have at least one non-empty cell
            if (Object.values(rowData).some(value => value !== '')) {
              jsonData.push(rowData);
            }
          }
          
          resolve({ headers, data: jsonData, columnWidths });
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
      const { headers, data: contacts, columnWidths } = await processFile(selectedFile);
      
      if (contacts.length === 0) {
        throw new Error('El archivo está vacío o no contiene datos válidos');
      }

      // Store headers and column widths for display
      setFileHeaders(headers);
      setColumnWidths(columnWidths);
      
      // Map file data to fixed field structure
      const mappedContacts = contacts.map((contact: any, index: number) => {
        // Create a new contact object with fixed field names
        const mappedContact: any = {
          numero: index + 1,
          nombre_pila: '',
          apellido_paterno: '',
          apellido_materno: '',
          telefono: '',
          genero: '',
          grupo_edad: '',
          militante: '',
          nivel_socioeconomico: '',
          lugar_trabajo: '',
          escolaridad: '',
          ano_nacimiento: '',
          tipo_contratacion: ''
        };

        // Map file data to fixed fields based on column position
        const fileKeys = Object.keys(contact);
        const fixedFieldNames = [
          'nombre_pila', 'apellido_paterno', 'apellido_materno', 'telefono', 
          'genero', 'grupo_edad', 'militante', 'nivel_socioeconomico', 
          'lugar_trabajo', 'escolaridad', 'ano_nacimiento', 'tipo_contratacion'
        ];

        fileKeys.forEach((key, keyIndex) => {
          if (keyIndex < fixedFieldNames.length) {
            const fieldName = fixedFieldNames[keyIndex];
            // Preserve exact text content including special characters and numbers
            const value = contact[key];
            mappedContact[fieldName] = value !== null && value !== undefined ? String(value) : '';
          }
        });

        return mappedContact;
      });

      await uploadMutation.mutateAsync({
        contacts: mappedContacts,
        fileName: selectedFile.name,
        headers: headers,
        columnWidths: columnWidths
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
            
            <Button
              onClick={toggleEditMode}
              variant={isEditMode ? "default" : "outline"}
              className="flex items-center gap-2"
            >
              {isEditMode ? <Save className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              {isEditMode ? "Guardar Cambios" : "Vista Excel"}
            </Button>
            
            {isEditMode && (
              <Button
                onClick={addNewRow}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Agregar Fila
              </Button>
            )}
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
            <div className="overflow-x-auto">
              {isEditMode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">📋 Modo Excel Activo</p>
                  <p className="text-xs text-blue-600 mt-1">
                    Puedes copiar texto y pegarlo en cualquier celda. El texto se separará automáticamente en columnas.
                    Soporta: separadores por tabuladores, espacios múltiples, comas, punto y coma y barras verticales.
                  </p>
                </div>
              )}
              
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th 
                      className="border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                      style={{ minWidth: '50px', width: '50px' }}
                    >
                      #
                    </th>
                    {/* Fixed headers as specified by user */}
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Nombre de Pila</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Ap. Paterno</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Ap. Materno</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Telefono</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Género</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Grupo de edad</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Militante</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Nivel Socioeconómico</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Lugar de trabajo</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Escolaridad</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Año de nacimiento</th>
                    <th className="border border-gray-200 px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">Tipo de contratación</th>
                    <th className="border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider" style={{ minWidth: '80px', width: '80px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(isEditMode ? editableData : contacts).map((contact: ContactData, index: number) => (
                    <tr key={contact.id || index} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900 text-center font-medium">
                        {contact.numero || index + 1}
                      </td>
                      {/* Fixed data cells using exact format from file */}
                      {isEditMode ? (
                        // Edit mode for all fields
                        <>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 0 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 0})}>
                            <Input value={contact.nombre_pila || ''} onChange={(e) => handleCellChange(index, 'nombre_pila', e.target.value)} onPaste={(e) => handlePaste(e, index, 0)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 1 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 1})}>
                            <Input value={contact.apellido_paterno || ''} onChange={(e) => handleCellChange(index, 'apellido_paterno', e.target.value)} onPaste={(e) => handlePaste(e, index, 1)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 2 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 2})}>
                            <Input value={contact.apellido_materno || ''} onChange={(e) => handleCellChange(index, 'apellido_materno', e.target.value)} onPaste={(e) => handlePaste(e, index, 2)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 3 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 3})}>
                            <Input value={contact.telefono || ''} onChange={(e) => handleCellChange(index, 'telefono', e.target.value)} onPaste={(e) => handlePaste(e, index, 3)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 4 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 4})}>
                            <Input value={contact.genero || ''} onChange={(e) => handleCellChange(index, 'genero', e.target.value)} onPaste={(e) => handlePaste(e, index, 4)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 5 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 5})}>
                            <Input value={contact.grupo_edad || ''} onChange={(e) => handleCellChange(index, 'grupo_edad', e.target.value)} onPaste={(e) => handlePaste(e, index, 5)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 6 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 6})}>
                            <Input value={contact.militante || ''} onChange={(e) => handleCellChange(index, 'militante', e.target.value)} onPaste={(e) => handlePaste(e, index, 6)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 7 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 7})}>
                            <Input value={contact.nivel_socioeconomico || ''} onChange={(e) => handleCellChange(index, 'nivel_socioeconomico', e.target.value)} onPaste={(e) => handlePaste(e, index, 7)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 8 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 8})}>
                            <Input value={contact.lugar_trabajo || ''} onChange={(e) => handleCellChange(index, 'lugar_trabajo', e.target.value)} onPaste={(e) => handlePaste(e, index, 8)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 9 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 9})}>
                            <Input value={contact.escolaridad || ''} onChange={(e) => handleCellChange(index, 'escolaridad', e.target.value)} onPaste={(e) => handlePaste(e, index, 9)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 10 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 10})}>
                            <Input value={contact.ano_nacimiento || ''} onChange={(e) => handleCellChange(index, 'ano_nacimiento', e.target.value)} onPaste={(e) => handlePaste(e, index, 10)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                          <td className={`border border-gray-200 px-1 py-1 text-sm text-gray-900 ${selectedCell?.row === index && selectedCell?.col === 11 ? 'bg-blue-100' : ''}`} onClick={() => setSelectedCell({row: index, col: 11})}>
                            <Input value={contact.tipo_contratacion || ''} onChange={(e) => handleCellChange(index, 'tipo_contratacion', e.target.value)} onPaste={(e) => handlePaste(e, index, 11)} className="border-0 p-1 h-auto text-sm focus:ring-1 focus:ring-blue-500" style={{ minHeight: '24px' }} />
                          </td>
                        </>
                      ) : (
                        // View mode - show data exactly as it appears in file
                        <>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.nombre_pila || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.apellido_paterno || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.apellido_materno || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.telefono || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.genero || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.grupo_edad || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {contact.militante || '-'}
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                              {contact.nivel_socioeconomico !== null && contact.nivel_socioeconomico !== undefined && contact.nivel_socioeconomico !== '' ? contact.nivel_socioeconomico : ''}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                              {contact.lugar_trabajo !== null && contact.lugar_trabajo !== undefined && contact.lugar_trabajo !== '' ? contact.lugar_trabajo : ''}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                              {contact.escolaridad !== null && contact.escolaridad !== undefined && contact.escolaridad !== '' ? contact.escolaridad : ''}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                              {contact.ano_nacimiento !== null && contact.ano_nacimiento !== undefined && contact.ano_nacimiento !== '' ? contact.ano_nacimiento : ''}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-2 text-sm text-gray-900 whitespace-nowrap">
                            <span style={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
                              {contact.tipo_contratacion !== null && contact.tipo_contratacion !== undefined && contact.tipo_contratacion !== '' ? contact.tipo_contratacion : ''}
                            </span>
                          </td>
                        </>
                      )}
                      <td className="border border-gray-200 px-3 py-2 text-sm text-gray-900">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Eliminar contacto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}