import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear datos de ejemplo para un archivo Excel
const data = [
  {
    nombre: 'Carlos Martínez',
    empresa: 'TechSolutions',
    telefono: '123456789',
    ubicacion: 'Ciudad de México',
    suscripcion: 'Plan Premium',
    compañia: 'Telecomunicaciones XYZ',
    fecha_inicio: '01/01/2023',
    motivo: 'Cambio de plan'
  },
  {
    nombre: 'Ana Rodríguez',
    empresa: 'Marketing Global',
    telefono: '987654321',
    ubicacion: 'Guadalajara',
    suscripcion: 'Plan Empresarial',
    compañia: 'Telecomunicaciones XYZ',
    fecha_inicio: '15/03/2023',
    motivo: 'Finalización de contrato'
  },
  {
    nombre: 'Juan Pérez',
    empresa: 'Consultores Asociados',
    telefono: '555123456',
    ubicacion: 'Monterrey',
    suscripcion: 'Plan Básico',
    compañia: 'Telecomunicaciones XYZ',
    fecha_inicio: '20/06/2023',
    motivo: 'Cambio de domicilio'
  }
];

// Crear un nuevo libro de trabajo
const workbook = XLSX.utils.book_new();

// Convertir los datos a una hoja de trabajo
const worksheet = XLSX.utils.json_to_sheet(data);

// Añadir la hoja al libro
XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');

// Asegurarse de que el directorio existe
const tempDir = path.join(process.cwd(), 'temp', 'uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Guardar el archivo
const filename = path.join(tempDir, 'clientes_ejemplo.xlsx');
XLSX.writeFile(workbook, filename);

console.log(`Archivo Excel creado en: ${filename}`);