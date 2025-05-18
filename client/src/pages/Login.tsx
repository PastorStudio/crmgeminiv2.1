import { useState } from "react";
import { Helmet } from "react-helmet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

// Definir esquema de validación
const loginSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es obligatorio"),
  password: z.string().min(1, "La contraseña es obligatoria"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [loginError, setLoginError] = useState<string | null>(null);

  // Configurar react-hook-form con zod validator
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Mutación para iniciar sesión
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormValues) => {
      return apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Inicio de sesión exitoso",
          description: `Bienvenido, ${data.user.fullName || data.user.username}`,
        });
        
        // Redirigir al dashboard
        navigate("/");
      } else {
        setLoginError(data.message || "Error al iniciar sesión");
      }
    },
    onError: (error) => {
      console.error("Error de inicio de sesión:", error);
      setLoginError("Error al conectar con el servidor. Intente de nuevo más tarde.");
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    setLoginError(null);
    loginMutation.mutate(values);
  };

  return (
    <>
      <Helmet>
        <title>Iniciar sesión | CRM con Gemini</title>
        <meta
          name="description"
          content="Inicie sesión en el sistema CRM con Gemini para gestionar clientes, leads y múltiples cuentas de WhatsApp."
        />
      </Helmet>

      <div className="flex flex-col min-h-screen justify-center items-center p-4 bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-primary-700 mb-2">CRM con Gemini</h1>
            <p className="text-gray-600">Sistema inteligente de gestión de clientes</p>
          </div>

          <Card className="w-full">
            <CardHeader>
              <CardTitle className="text-xl">Iniciar Sesión</CardTitle>
              <CardDescription>
                Ingrese sus credenciales para acceder al sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loginError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Usuario</FormLabel>
                        <FormControl>
                          <Input placeholder="Ingrese su nombre de usuario" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Ingrese su contraseña"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <div className="text-xs text-gray-500 text-center w-full">
                La sesión se cerrará automáticamente después de 24 horas de inactividad
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  );
}