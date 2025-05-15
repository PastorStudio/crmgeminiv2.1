import * as fs from 'fs';
import * as path from 'path';
import { nanoid } from 'nanoid';
import * as XLSX from 'xlsx';

// Interface para manejar datos de contactos
export interface ContactData {
  id: string;
  phoneNumber: string;
  name?: string;
  company?: string;
  email?: string;
  tags?: string[];
  [key: string]: any; // Para campos personalizados
}

// Interface para manejar datos importados
export interface ImportResult {
  id: string;
  filename: string;
  originalname: string;
  importedAt: Date;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  contacts: ContactData[];
  fieldMapping: Record<string, string>;
  errors?: string[];
}

// Service para importar datos desde Excel
// Interface para manejar datos de envío con plantillas
export interface TemplateContactBatch {
  templateId: number;
  contactIds: string[];
  variables: Record<string, any>[];
}

export class ExcelImportService {
  private imports: Map<string, ImportResult> = new Map();
  private uploadsDir: string;

  constructor() {
    // Directorio para almacenar archivos temporales
    this.uploadsDir = path.join(process.cwd(), 'temp', 'uploads');
    
    // Asegurarse de que el directorio existe
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // Guardar un archivo subido
  async saveUploadedFile(file: Express.Multer.File): Promise<string> {
    const filename = `${Date.now()}_${nanoid()}_${file.originalname}`;
    const filepath = path.join(this.uploadsDir, filename);
    
    // Guardar el archivo
    await fs.promises.writeFile(filepath, file.buffer);
    
    return filename;
  }

  // Obtener la ruta completa de un archivo
  getFilePath(filename: string): string {
    return path.join(this.uploadsDir, filename);
  }

  // Importar datos desde un archivo Excel
  async importFromExcel(
    filename: string, 
    originalname: string, 
    fieldMapping: Record<string, string>
  ): Promise<ImportResult> {
    try {
      const filepath = this.getFilePath(filename);
      
      // Leer el archivo con opciones para manejar archivos con macros (.xlsm)
      const workbook = XLSX.readFile(filepath, {
        cellFormula: false, // Deshabilitar evaluación de fórmulas
        bookVBA: true, // Preservar VBA/macros
        cellStyles: false, // Ignorar estilos para mejorar rendimiento
        cellNF: false, // Ignorar formato de números
        cellDates: true, // Mantener fechas como fechas
      });
      
      // Verificar que el workbook tenga hojas
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in the Excel file');
      }
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        throw new Error('Worksheet is undefined');
      }
      
      // Convertir a JSON con manejo de errores mejorado
      const data = XLSX.utils.sheet_to_json<any>(worksheet, {
        defval: "", // Valor predeterminado para celdas vacías
        blankrows: false // Ignorar filas en blanco
      });
      
      if (!Array.isArray(data)) {
        throw new Error('Failed to convert Excel data to JSON');
      }
      
      // Procesar los datos según el mapeo de campos
      const contacts: ContactData[] = [];
      let validRows = 0;
      let invalidRows = 0;
      
      for (const row of data) {
        try {
          // Verificar si existe el número de teléfono (campo obligatorio)
          const phoneField = fieldMapping.phoneNumber || 'phoneNumber';
          if (!row[phoneField]) {
            invalidRows++;
            continue;
          }
          
          // Formatear número de teléfono
          const phoneRaw = String(row[phoneField]);
          const phone = this.formatPhoneNumber(phoneRaw);
          
          if (!phone) {
            invalidRows++;
            continue;
          }
          
          // Crear objeto de contacto
          const contact: ContactData = {
            id: nanoid(),
            phoneNumber: phone
          };
          
          // Agregar otros campos según el mapeo
          for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
            if (targetField !== 'phoneNumber' && row[sourceField] !== undefined) {
              contact[targetField] = row[sourceField];
            }
          }
          
          // Si hay un campo para tags, convertirlo a array
          if (fieldMapping.tags && row[fieldMapping.tags]) {
            contact.tags = String(row[fieldMapping.tags])
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag.length > 0);
          }
          
          contacts.push(contact);
          validRows++;
        } catch (err) {
          invalidRows++;
        }
      }
      
      // Crear resultado de importación
      const importResult: ImportResult = {
        id: nanoid(),
        filename,
        originalname,
        importedAt: new Date(),
        totalRows: data.length,
        validRows,
        invalidRows,
        contacts,
        fieldMapping
      };
      
      // Guardar en el mapa de importaciones
      this.imports.set(importResult.id, importResult);
      
      return importResult;
    } catch (error) {
      console.error('Error importing Excel file:', error);
      throw new Error(`Error importing Excel file: ${error.message}`);
    }
  }

  // Obtener resultado de importación por ID
  getImportResult(id: string): ImportResult | undefined {
    return this.imports.get(id);
  }

  // Listar todas las importaciones
  listImports(): ImportResult[] {
    return Array.from(this.imports.values());
  }

  // Eliminar una importación
  deleteImport(id: string): boolean {
    const importResult = this.imports.get(id);
    if (importResult) {
      // Eliminar el archivo asociado
      try {
        const filepath = this.getFilePath(importResult.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      } catch (error) {
        console.error('Error deleting import file:', error);
      }
      
      // Eliminar del mapa
      return this.imports.delete(id);
    }
    return false;
  }

  // Formatear número de teléfono al formato de WhatsApp
  private formatPhoneNumber(phone: string): string | null {
    // Eliminar caracteres no numéricos
    const digits = phone.replace(/\D/g, '');
    
    // Debe tener al menos 8 dígitos
    if (digits.length < 8) {
      return null;
    }
    
    // WhatsApp requiere código de país
    // Si no tiene código de país (asumiendo números de 8-10 dígitos sin código),
    // agregaremos un código por defecto (puede ser configurado según el país)
    let formattedPhone = digits;
    if (digits.length <= 10 && !digits.startsWith('1') && !digits.startsWith('52') && !digits.startsWith('57')) {
      // Añadir código por defecto (ejemplo: 1 para USA)
      formattedPhone = '1' + digits;
    }
    
    return formattedPhone;
  }

  // Analizar archivo Excel para obtener sus columnas
  async analyzeExcelFile(filename: string): Promise<{columns: string[], suggestedMapping: Record<string, string>}> {
    try {
      const filepath = this.getFilePath(filename);
      
      // Leer el archivo con opciones para manejar archivos con macros (.xlsm)
      const workbook = XLSX.readFile(filepath, {
        cellFormula: false, // Deshabilitar evaluación de fórmulas
        bookVBA: true, // Preservar VBA/macros
        cellStyles: false, // Ignorar estilos para mejorar rendimiento
        cellNF: false, // Ignorar formato de números
        cellDates: true, // Mantener fechas como fechas
      });
      
      // Si no hay hojas, devolver array vacío
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.error('No sheets found in the Excel file');
        return { columns: [], suggestedMapping: {} };
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        console.error('Worksheet is undefined');
        return { columns: [], suggestedMapping: {} };
      }
      
      // Obtener la primera fila (encabezados) con manejo de errores mejorado
      try {
        // Intentar obtener por encabezados
        const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
        
        if (data.length === 0) {
          console.log('No data found');
          return { columns: [], suggestedMapping: {} };
        }
        
        // Revisar si la primera fila contiene encabezados o si son datos
        const firstRow = data[0];
        
        // Si no hay encabezados o no son un array, crear columnas alfabéticas
        if (!Array.isArray(firstRow) || firstRow.length === 0) {
          console.log('Creating alphabetical columns as headers not found');
          // Crear columnas alfabéticas (A, B, C...)
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const numCols = Object.keys(worksheet).reduce((max, cell) => {
            if (cell[0] === '!') return max; // Ignorar propiedades especiales
            const col = cell.replace(/[0-9]/g, '');
            return Math.max(max, alphabet.indexOf(col) + 1);
          }, 0);
          
          const columns = Array.from({ length: numCols }, (_, i) => alphabet[i]);
          
          // Sugerir mapeo automático: columna B para nombre y C para teléfono
          const suggestedMapping: Record<string, string> = {
            name: 'B',
            phoneNumber: 'C'
          };
          
          return { columns, suggestedMapping };
        }
        
        // Filtrar columnas válidas
        const columns = firstRow.filter(col => col !== undefined && col !== null).map(String);
        
        // Crear mapeo sugerido basado en heurísticas
        const suggestedMapping: Record<string, string> = {};
        
        // Intentar identificar columnas por nombre
        columns.forEach((col, index) => {
          const colLower = String(col).toLowerCase();
          
          // Intentar identificar columna de teléfono
          if (colLower.includes('tel') || colLower.includes('phone') || colLower.includes('móvil') || colLower.includes('movil') || colLower.includes('celular')) {
            suggestedMapping.phoneNumber = col;
          }
          
          // Intentar identificar columna de nombre
          if (colLower.includes('nombre') || colLower.includes('name') || colLower === 'cliente') {
            suggestedMapping.name = col;
          }
          
          // Intentar identificar columna de empresa
          if (colLower.includes('empresa') || colLower.includes('company') || colLower.includes('negocio') || colLower.includes('business')) {
            suggestedMapping.company = col;
          }
          
          // Intentar identificar columna de email
          if (colLower.includes('email') || colLower.includes('correo') || colLower.includes('mail')) {
            suggestedMapping.email = col;
          }
        });
        
        // Si no se identificaron por nombre, usar columnas B y C por defecto
        if (!suggestedMapping.name && columns.length >= 2) {
          suggestedMapping.name = columns[1]; // Segunda columna (B)
        }
        
        if (!suggestedMapping.phoneNumber && columns.length >= 3) {
          suggestedMapping.phoneNumber = columns[2]; // Tercera columna (C)
        }
        
        return { columns, suggestedMapping };
      } catch (innerError) {
        console.error('Error converting worksheet to JSON:', innerError);
        return { columns: [], suggestedMapping: {} };
      }
    } catch (error) {
      console.error('Error analyzing Excel file:', error);
      throw new Error(`Error analyzing Excel file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Preparar un lote de contactos con sus variables para usar con una plantilla
  prepareTemplateContactBatch(
    importId: string, 
    templateId: number, 
    variableMapping: Record<string, string>
  ): TemplateContactBatch | null {
    const importResult = this.getImportResult(importId);
    if (!importResult) return null;
    
    const contactIds: string[] = [];
    const variables: Record<string, any>[] = [];
    
    // Para cada contacto en la importación, extraer sus variables
    for (const contact of importResult.contacts) {
      contactIds.push(contact.id);
      
      // Mapear las variables del contacto según el mapeo proporcionado
      const contactVariables: Record<string, any> = {};
      
      for (const [templateVar, contactField] of Object.entries(variableMapping)) {
        // Si el campo es un valor constante (empieza con @), usar el valor literal sin @
        if (contactField.startsWith('@')) {
          contactVariables[templateVar] = contactField.substring(1);
        } 
        // Si no, obtener el valor del contacto
        else if (contact[contactField] !== undefined) {
          contactVariables[templateVar] = contact[contactField];
        }
      }
      
      variables.push(contactVariables);
    }
    
    return {
      templateId,
      contactIds,
      variables
    };
  }
  
  // Generar mensaje personalizado usando una plantilla y variables
  generatePersonalizedMessage(
    templateContent: string,
    variables: Record<string, any>
  ): string {
    let result = templateContent;
    
    // Reemplazar variables en el formato {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      if (value !== undefined && value !== null) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, String(value));
      }
    }
    
    return result;
  }
}

export const excelImportService = new ExcelImportService();
