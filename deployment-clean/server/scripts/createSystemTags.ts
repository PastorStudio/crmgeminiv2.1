import { db } from '../db';
import { tags } from '../../shared/schema';

const systemTags = [
  // Priority tags
  { name: 'Alta Prioridad', color: '#EF4444', category: 'priority', description: 'Leads de alta prioridad que requieren atención inmediata', isSystem: true },
  { name: 'Media Prioridad', color: '#F59E0B', category: 'priority', description: 'Leads de prioridad media', isSystem: true },
  { name: 'Baja Prioridad', color: '#10B981', category: 'priority', description: 'Leads de baja prioridad', isSystem: true },
  
  // Status tags
  { name: 'Nuevo', color: '#3B82F6', category: 'status', description: 'Lead recién creado', isSystem: true },
  { name: 'En Progreso', color: '#8B5CF6', category: 'status', description: 'Lead en proceso de gestión', isSystem: true },
  { name: 'Calificado', color: '#06B6D4', category: 'status', description: 'Lead calificado y validado', isSystem: true },
  { name: 'Cerrado Ganado', color: '#22C55E', category: 'status', description: 'Lead convertido exitosamente', isSystem: true },
  { name: 'Cerrado Perdido', color: '#EF4444', category: 'status', description: 'Lead perdido o descartado', isSystem: true },
  
  // Source tags
  { name: 'WhatsApp', color: '#25D366', category: 'general', description: 'Lead generado desde WhatsApp', isSystem: true },
  { name: 'Web', color: '#3B82F6', category: 'general', description: 'Lead generado desde sitio web', isSystem: true },
  { name: 'Referido', color: '#F59E0B', category: 'general', description: 'Lead referido por cliente existente', isSystem: true },
  { name: 'Llamada', color: '#8B5CF6', category: 'general', description: 'Lead generado por llamada telefónica', isSystem: true },
  
  // Industry tags
  { name: 'Tecnología', color: '#06B6D4', category: 'custom', description: 'Cliente del sector tecnológico', isSystem: true },
  { name: 'Retail', color: '#EC4899', category: 'custom', description: 'Cliente del sector retail', isSystem: true },
  { name: 'Servicios', color: '#84CC16', category: 'custom', description: 'Cliente del sector servicios', isSystem: true },
  { name: 'Educación', color: '#F97316', category: 'custom', description: 'Cliente del sector educativo', isSystem: true },
  
  // Communication tags
  { name: 'Seguimiento', color: '#6366F1', category: 'general', description: 'Requiere seguimiento periódico', isSystem: true },
  { name: 'Urgente', color: '#DC2626', category: 'priority', description: 'Requiere atención urgente', isSystem: true },
  { name: 'VIP', color: '#7C2D12', category: 'priority', description: 'Cliente VIP con tratamiento especial', isSystem: true },
  { name: 'Demo Solicitada', color: '#0891B2', category: 'status', description: 'Cliente solicitó demostración', isSystem: true }
];

export async function createSystemTags() {
  try {
    console.log('🏷️ Creando etiquetas del sistema...');
    
    for (const tag of systemTags) {
      // Check if tag already exists
      const existingTag = await db.query.tags.findFirst({
        where: (tags, { eq, and }) => and(
          eq(tags.name, tag.name),
          eq(tags.isSystem, true)
        )
      });
      
      if (!existingTag) {
        await db.insert(tags).values(tag);
        console.log(`✅ Etiqueta creada: ${tag.name} (${tag.category})`);
      } else {
        console.log(`⏭️ Etiqueta ya existe: ${tag.name}`);
      }
    }
    
    console.log('🎉 Etiquetas del sistema creadas exitosamente');
    return { success: true, created: systemTags.length };
  } catch (error) {
    console.error('❌ Error creando etiquetas del sistema:', error);
    throw error;
  }
}

// Auto-execute if called directly
if (require.main === module) {
  createSystemTags().then(() => {
    console.log('✅ Script ejecutado exitosamente');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Error ejecutando script:', error);
    process.exit(1);
  });
}