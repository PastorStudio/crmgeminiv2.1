import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts } = useToast()

  // Filtrar toasts para mostrar mensajes importantes incluyendo importación
  const filteredToasts = toasts.filter(toast => {
    if (!toast || typeof toast !== 'object') return false;
    
    // Mostrar toasts de error, éxito de configuración, importación y mensajes importantes
    return toast.variant === 'destructive' || 
           (toast.title && typeof toast.title === 'string' && (
             toast.title.toLowerCase().includes('error') ||
             toast.title.toLowerCase().includes('fallo') ||
             toast.title.toLowerCase().includes('problema') ||
             toast.title.toLowerCase().includes('desconectado') ||
             toast.title.toLowerCase().includes('configuración') ||
             toast.title.toLowerCase().includes('guardada') ||
             toast.title.toLowerCase().includes('creada') ||
             toast.title.toLowerCase().includes('actualizada') ||
             toast.title.toLowerCase().includes('cargadas') ||
             toast.title.toLowerCase().includes('importación') ||
             toast.title.toLowerCase().includes('importado') ||
             toast.title.toLowerCase().includes('eliminado') ||
             toast.title.toLowerCase().includes('eliminados')
           )) ||
           (toast.description && typeof toast.description === 'string' && (
             toast.description.toLowerCase().includes('error') ||
             toast.description.toLowerCase().includes('fallo') ||
             toast.description.toLowerCase().includes('problema') ||
             toast.description.toLowerCase().includes('configuraciones') ||
             toast.description.toLowerCase().includes('guardadas') ||
             toast.description.toLowerCase().includes('exitosamente') ||
             toast.description.toLowerCase().includes('importaron') ||
             toast.description.toLowerCase().includes('contactos') ||
             toast.description.toLowerCase().includes('correctamente')
           ))
  })

  return (
    <ToastProvider>
      {filteredToasts.map(function (toast) {
        if (!toast || !toast.id) return null;
        
        const { id, title, description, action, ...props } = toast;
        
        // Ensure description is safe to render
        const safeDescription = description && typeof description === 'string' 
          ? description 
          : description && typeof description === 'object' && description.toString 
            ? description.toString() 
            : '';
            
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {safeDescription && (
                <ToastDescription>{safeDescription}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
