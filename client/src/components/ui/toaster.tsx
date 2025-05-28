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

  // Filtrar toasts para mostrar solo errores importantes
  const filteredToasts = toasts.filter(toast => {
    // Solo mostrar toasts de error o críticos
    return toast.variant === 'destructive' || 
           (toast.title && (
             toast.title.toLowerCase().includes('error') ||
             toast.title.toLowerCase().includes('fallo') ||
             toast.title.toLowerCase().includes('problema') ||
             toast.title.toLowerCase().includes('desconectado')
           )) ||
           (toast.description && (
             toast.description.toLowerCase().includes('error') ||
             toast.description.toLowerCase().includes('fallo') ||
             toast.description.toLowerCase().includes('problema')
           ))
  })

  return (
    <ToastProvider>
      {filteredToasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
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
