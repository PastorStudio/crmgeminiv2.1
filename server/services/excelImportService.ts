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
    try {
      // Asegurar que el directorio existe
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
      
      const filename = `${Date.now()}_${nanoid()}_${file.originalname}`;
      const filepath = path.join(this.uploadsDir, filename);
      
      // Guardar el archivo
      await fs.promises.writeFile(filepath, file.buffer);
      
      // Verificar que el archivo se guardó correctamente
      if (!fs.existsSync(filepath)) {
        throw new Error(`No se pudo guardar el archivo en: ${filepath}`);
      }
      
      console.log(`Archivo Excel guardado correctamente en: ${filepath}`);
      return filename;
    } catch (error) {
      console.error('Error guardando archivo Excel:', error);
      throw error;
    }
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
    console.log(`Iniciando importación de Excel. Archivo: ${filename}, Mapeo:`, fieldMapping);
    
    try {
      const filepath = this.getFilePath(filename);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(filepath)) {
        console.error(`Archivo no encontrado: ${filepath}`);
        throw new Error(`El archivo ${filename} no existe en el servidor`);
      }
      
      let workbook;
      try {
        // Leer el archivo con opciones para mejorar compatibilidad
        console.log('Intentando leer archivo Excel con configuración mejorada...');
        workbook = XLSX.readFile(filepath, {
          cellFormula: false,      // Deshabilitar evaluación de fórmulas
          bookVBA: false,          // Ignorar VBA/macros para evitar errores
          cellStyles: false,       // Ignorar estilos para mejorar rendimiento
          cellNF: false,           // Ignorar formato de números
          cellDates: true,         // Mantener fechas como fechas
          type: 'binary',          // Usar lectura binaria para mayor compatibilidad
          raw: true,               // No procesar valores especiales
          WTF: true                // Modo más permisivo para archivos problemáticos
        });
      } catch (readError) {
        console.error('Error al leer archivo Excel, intentando método alternativo:', readError);
        
        // Método alternativo de lectura
        try {
          const fileBuffer = fs.readFileSync(filepath);
          workbook = XLSX.read(fileBuffer, {
            type: 'buffer',
            cellFormula: false,
            cellDates: true
          });
        } catch (alternativeError) {
          console.error('Error en método alternativo de lectura:', alternativeError);
          throw new Error(`No se pudo leer el archivo Excel: ${alternativeError instanceof Error ? alternativeError.message : String(alternativeError)}`);
        }
      }
      
      // Verificar que el workbook tenga hojas
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.error('No se encontraron hojas en el archivo Excel');
        throw new Error('No se encontraron hojas en el archivo Excel');
      }
      
      console.log(`Hojas encontradas: ${workbook.SheetNames.length}`);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        console.error('Hoja de trabajo no definida');
        throw new Error('Hoja de trabajo no definida');
      }
      
      // Convertir a JSON con manejo de errores mejorado
      let data;
      try {
        console.log('Convirtiendo datos de la hoja a JSON...');
        data = XLSX.utils.sheet_to_json<any>(worksheet, {
          defval: "",        // Valor predeterminado para celdas vacías
          blankrows: false,  // Ignorar filas en blanco
          raw: true          // Mantener valores sin formatear
        });
      } catch (jsonError) {
        console.error('Error convirtiendo hoja a JSON:', jsonError);
        throw new Error(`Error procesando datos del archivo Excel: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
      }
      
      if (!Array.isArray(data)) {
        console.error('Los datos convertidos no son un array');
        throw new Error('Error al convertir datos del Excel: formato inesperado');
      }
      
      console.log(`Se encontraron ${data.length} filas en la hoja de trabajo`);
      
      // Verificar que el mapeo incluya la columna de teléfono
      if (!fieldMapping.phoneNumber) {
        console.error('El mapeo no incluye el campo phoneNumber:', fieldMapping);
        throw new Error('El mapeo de campos debe incluir al menos "phoneNumber"');
      }
      
      // Procesar los datos según el mapeo de campos
      const contacts: ContactData[] = [];
      let validRows = 0;
      let invalidRows = 0;
      const errors: string[] = [];
      
      console.log(`Procesando ${data.length} filas...`);
      
      for (const row of data) {
        try {
          // Verificar si existe el número de teléfono (campo obligatorio)
          const phoneField = fieldMapping.phoneNumber;
          if (row[phoneField] === undefined || row[phoneField] === null || row[phoneField] === '') {
            const rowDesc = JSON.stringify(row).substring(0, 100) + '...';
            console.log(`Fila sin número de teléfono: ${rowDesc}`);
            errors.push(`Fila sin número de teléfono: ${rowDesc}`);
            invalidRows++;
            continue;
          }
          
          // Formatear número de teléfono
          const phoneRaw = typeof row[phoneField] === 'number' ? 
            String(row[phoneField]) : 
            String(row[phoneField]).trim();
            
          const phone = this.formatPhoneNumber(phoneRaw);
          
          if (!phone) {
            const rowDesc = JSON.stringify(row).substring(0, 100) + '...';
            console.log(`Número de teléfono inválido: ${phoneRaw} en fila: ${rowDesc}`);
            errors.push(`Número de teléfono inválido: ${phoneRaw} en fila: ${rowDesc}`);
            invalidRows++;
            continue;
          }
          
          // Crear objeto de contacto
          const contact: ContactData = {
            id: nanoid(),
            phoneNumber: phone
          };
          
          // Agregar nombre si está mapeado
          if (fieldMapping.name && row[fieldMapping.name] !== undefined) {
            contact.name = String(row[fieldMapping.name]).trim();
          }
          
          // Agregar otros campos según el mapeo
          for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
            if (targetField !== 'phoneNumber' && targetField !== 'name' && 
                sourceField && row[sourceField] !== undefined && row[sourceField] !== null) {
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
          console.error('Error procesando fila:', err);
          const errorMsg = err instanceof Error ? err.message : String(err);
          errors.push(`Error procesando fila: ${errorMsg}`);
          invalidRows++;
        }
      }
      
      console.log(`Importación finalizada: ${validRows} filas válidas, ${invalidRows} filas inválidas, ${contacts.length} contactos importados`);
      
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
        fieldMapping,
        errors: errors.length > 0 ? errors : undefined
      };
      
      // Guardar en el mapa de importaciones
      this.imports.set(importResult.id, importResult);
      
      console.log(`Resultado de importación guardado con id: ${importResult.id}`);
      
      return importResult;
    } catch (err) {
      console.error('Error importando archivo Excel:', err);
      throw new Error(`Error al importar archivo Excel: ${err instanceof Error ? err.message : String(err)}`);
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
      console.log(`Analizando archivo Excel en: ${filepath}`);
      
      // Verificar que el archivo exista
      if (!fs.existsSync(filepath)) {
        console.error(`Archivo no encontrado en la ruta: ${filepath}`);
        throw new Error(`El archivo ${filename} no existe en el servidor`);
      }
      
      // Leer el archivo con diferentes opciones
      try {
        console.log('Intentando leer archivo Excel con XLSX.readFile...');
        
        // Leer el archivo con opciones permisivas para mejorar compatibilidad
        const workbook = XLSX.readFile(filepath, {
          cellFormula: false,       // Deshabilitar evaluación de fórmulas
          bookVBA: false,           // Ignorar VBA/macros para evitar errores
          cellStyles: false,        // Ignorar estilos para mejorar rendimiento
          cellNF: false,            // Ignorar formato de números
          cellDates: true,          // Mantener fechas como fechas
          type: 'binary',           // Usar lectura binaria para mayor compatibilidad
          raw: true,                // No procesar valores especiales
          WTF: true                 // Modo más permisivo para archivos problemáticos
        });
        
        console.log(`Archivo leído correctamente. Hojas encontradas: ${workbook.SheetNames?.length || 0}`);
        
        // Si no hay hojas, devolver array vacío
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          console.error('No se encontraron hojas en el archivo Excel');
          return { columns: [], suggestedMapping: {} };
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          console.error('La hoja de trabajo es indefinida');
          return { columns: [], suggestedMapping: {} };
        }
        
        // Obtener la primera fila (encabezados) con manejo de errores mejorado
        try {
          console.log('Procesando datos de la hoja...');
          // Intentar obtener por encabezados
          const data = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
          
          if (!data || data.length === 0) {
            console.log('No se encontraron datos en la hoja');
            return { columns: [], suggestedMapping: {} };
          }
          
          console.log(`Se encontraron ${data.length} filas`);
          
          // Revisar si la primera fila contiene encabezados o si son datos
          const firstRow = data[0];
          
          // Si no hay encabezados o no son un array, crear columnas alfabéticas
          if (!Array.isArray(firstRow) || firstRow.length === 0) {
            console.log('Creando columnas alfabéticas ya que no se encontraron encabezados');
            // Crear columnas alfabéticas (A, B, C...)
            const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const numCols = Object.keys(worksheet).reduce((max, cell) => {
              if (cell[0] === '!') return max; // Ignorar propiedades especiales
              const col = cell.replace(/[0-9]/g, '');
              return Math.max(max, alphabet.indexOf(col) + 1);
            }, 0);
            
            console.log(`Se detectaron ${numCols} columnas en el archivo`);
            
            // Asegurar que hay al menos 1 columna
            const columns = Array.from({ length: Math.max(1, numCols) }, (_, i) => alphabet[i]);
            
            // Sugerir mapeo automático: columna A para nombre y B para teléfono
            const suggestedMapping: Record<string, string> = {
              name: columns[0] || 'A',
              phoneNumber: columns[1] || 'B'
            };
            
            return { columns, suggestedMapping };
          }
          
          console.log(`Primera fila (encabezados): ${JSON.stringify(firstRow)}`);
          
          // Filtrar columnas válidas
          const columns = firstRow
            .filter(col => col !== undefined && col !== null)
            .map(col => String(col).trim());
          
          console.log(`Columnas válidas detectadas: ${columns.length}`);
          
          // Crear mapeo sugerido basado en heurísticas
          const suggestedMapping: Record<string, string> = {};
          
          // Intentar identificar columnas por nombre
          columns.forEach((col, index) => {
            const colLower = String(col).toLowerCase();
            
            // Intentar identificar columna de teléfono
            if (colLower.includes('tel') || colLower.includes('phone') || 
                colLower.includes('móvil') || colLower.includes('movil') || 
                colLower.includes('celular') || colLower.includes('contacto')) {
              suggestedMapping.phoneNumber = col;
              console.log(`Columna de teléfono detectada: ${col}`);
            }
            
            // Intentar identificar columna de nombre
            if (colLower.includes('nombre') || colLower.includes('name') || 
                colLower === 'cliente' || colLower.includes('contact')) {
              suggestedMapping.name = col;
              console.log(`Columna de nombre detectada: ${col}`);
            }
            
            // Intentar identificar columna de empresa
            if (colLower.includes('empresa') || colLower.includes('company') || 
                colLower.includes('negocio') || colLower.includes('business')) {
              suggestedMapping.company = col;
              console.log(`Columna de empresa detectada: ${col}`);
            }
            
            // Intentar identificar columna de email
            if (colLower.includes('email') || colLower.includes('correo') || 
                colLower.includes('mail')) {
              suggestedMapping.email = col;
              console.log(`Columna de email detectada: ${col}`);
            }
          });
          
          // Si no hay columnas detectadas o son pocas, asegurar al menos las básicas
          if (columns.length > 0) {
            // Asignar columnas por defecto si no se detectaron automáticamente
            if (!suggestedMapping.phoneNumber && columns.length >= 1) {
              suggestedMapping.phoneNumber = columns[0]; // Primera columna para teléfono
              console.log(`Asignando primera columna (${columns[0]}) como teléfono por defecto`);
            }
            
            if (!suggestedMapping.name && columns.length >= 2) {
              suggestedMapping.name = columns[1]; // Segunda columna para nombre
              console.log(`Asignando segunda columna (${columns[1]}) como nombre por defecto`);
            }
          } else {
            console.log('No se detectaron columnas válidas');
          }
          
          console.log(`Mapeo sugerido: ${JSON.stringify(suggestedMapping)}`);
          return { columns, suggestedMapping };
        } catch (innerError) {
          console.error('Error al convertir hoja a JSON:', innerError);
          return { columns: [], suggestedMapping: {} };
        }
      } catch (readError) {
        console.error('Error al leer archivo Excel con readFile:', readError);
        
        // Intentar método alternativo de lectura
        try {
          console.log('Intentando método alternativo de lectura...');
          const fileBuffer = fs.readFileSync(filepath);
          const workbook = XLSX.read(fileBuffer, {
            type: 'buffer',
            cellFormula: false,
            cellDates: true
          });
          
          // Procesamiento similar al anterior...
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          if (!worksheet) {
            return { columns: [], suggestedMapping: {} };
          }
          
          // Simplificar para este método alternativo
          // Usar solo las columnas básicas A, B, C...
          const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
          const suggestedMapping = {
            phoneNumber: 'A',
            name: 'B'
          };
          
          return { columns, suggestedMapping };
        } catch (alternativeError) {
          console.error('Error en método alternativo de lectura:', alternativeError);
          throw readError; // Propagar el error original
        }
      }
    } catch (error) {
      console.error('Error analizando archivo Excel:', error);
      return { columns: [], suggestedMapping: {} }; // Retornar array vacío en lugar de lanzar error
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
