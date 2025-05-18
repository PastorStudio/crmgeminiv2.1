import axios from 'axios';
import fs from 'fs';
import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testTemplateVariables() {
  try {
    // Leer el archivo Excel para obtener los datos del primer cliente
    const excelPath = path.join(__dirname, 'temp', 'uploads', 'clientes_ejemplo.xlsx');
    const workbook = XLSX.readFile(excelPath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    if (data.length === 0) {
      console.error('No se encontraron datos en el archivo Excel');
      return;
    }
    
    // Tomar el primer cliente como ejemplo
    const cliente = data[0];
    console.log('Datos del cliente de prueba:', cliente);
    
    // ID de la plantilla a utilizar (podemos usar la plantilla formal de recuperación)
    const templateId = 1;
    
    // Realizar la solicitud para previsualizar el mensaje
    const response = await axios.post('http://localhost:5000/api/excel/preview-template-message', {
      templateId,
      variables: cliente
    });
    
    console.log('\nPrevisualización del mensaje con variables reemplazadas:');
    console.log('---------------------------------------------------------');
    console.log(response.data.message);
    console.log('---------------------------------------------------------');
    
    // También obtener las variables requeridas por la plantilla
    const variablesResponse = await axios.get(`http://localhost:5000/api/message-templates/${templateId}/variables`);
    console.log('\nVariables requeridas por la plantilla:');
    console.log(variablesResponse.data.variables);
    
    // Verificar qué variables del template pudieron ser reemplazadas
    console.log('\nAnálisis de reemplazo de variables:');
    variablesResponse.data.variables.forEach(variable => {
      if (cliente[variable]) {
        console.log(`✓ ${variable}: Reemplazada con "${cliente[variable]}"`);
      } else {
        console.log(`✗ ${variable}: No encontrada en el archivo Excel`);
      }
    });
    
  } catch (error) {
    console.error('Error al probar las variables de la plantilla:', error.message);
    if (error.response) {
      console.error('Detalles del error:', error.response.data);
    }
  }
}

testTemplateVariables();