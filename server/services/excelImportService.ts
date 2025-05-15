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
      
      // Leer el archivo
      const workbook = XLSX.readFile(filepath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convertir a JSON
      const data = XLSX.utils.sheet_to_json<any>(worksheet);
      
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
  async analyzeExcelFile(filename: string): Promise<string[]> {
    try {
      const filepath = this.getFilePath(filename);
      
      // Leer el archivo
      const workbook = XLSX.readFile(filepath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Obtener la primera fila (encabezados)
      const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
      
      if (data.length === 0 || !Array.isArray(data[0])) {
        return [];
      }
      
      // Devolver los nombres de las columnas
      return data[0].map(String);
    } catch (error) {
      console.error('Error analyzing Excel file:', error);
      throw new Error(`Error analyzing Excel file: ${error.message}`);
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
