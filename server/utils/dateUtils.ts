/**
 * Formatea una fecha en formato ISO a formato legible
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Devuelve una fecha hace X días desde hoy
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * Devuelve una fecha hace X meses desde hoy
 */
export function getMonthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

/**
 * Comprueba si una fecha está dentro de un rango especificado
 */
export function isDateInRange(date: Date | string, startDate: Date | string, endDate: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  return d >= start && d <= end;
}

/**
 * Calcula la diferencia en días entre dos fechas
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

/**
 * Convierte una fecha a formato ISO (YYYY-MM-DD)
 */
export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Obtiene el primer día del mes actual
 */
export function getFirstDayOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  return date;
}

/**
 * Obtiene el último día del mes actual
 */
export function getLastDayOfMonth(): Date {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setDate(0);
  return date;
}

/**
 * Agrupa una lista de elementos por año y mes
 */
export function groupByMonth<T>(items: T[], dateAccessor: (item: T) => Date | string): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const date = dateAccessor(item);
    const d = typeof date === 'string' ? new Date(date) : date;
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    
    if (!acc[key]) {
      acc[key] = [];
    }
    
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

/**
 * Obtiene el nombre del día de la semana 
 */
export function getDayName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', { weekday: 'long' });
}

/**
 * Obtiene el nombre del mes
 */
export function getMonthName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-ES', { month: 'long' });
}