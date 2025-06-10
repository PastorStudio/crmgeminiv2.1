import React, { useState } from 'react';
import { useAuth } from '@/lib/authContext';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, User, Lock, MessageCircle, Users, FileText, Phone, Send, CheckCircle, Shield } from 'lucide-react';

export default function Login() {
  const { login, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      } else {
        setError('Credenciales inválidas. Verifica tu usuario y contraseña.');
      }
    } catch (error) {
      setError('Error de conexión. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-black to-red-600">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating WhatsApp Business Icons - Distributed */}
        <div className="absolute top-20 left-20 animate-bounce delay-100">
          <MessageCircle className="h-12 w-12 text-green-400 opacity-30" />
        </div>
        <div className="absolute top-40 right-32 animate-pulse delay-300">
          <Users className="h-16 w-16 text-red-400 opacity-40" />
        </div>
        <div className="absolute bottom-40 left-40 animate-bounce delay-500">
          <FileText className="h-10 w-10 text-white opacity-25" />
        </div>
        <div className="absolute top-60 left-1/4 animate-pulse delay-700">
          <Phone className="h-14 w-14 text-green-500 opacity-35" />
        </div>
        <div className="absolute bottom-60 right-20 animate-bounce delay-900">
          <Send className="h-12 w-12 text-red-300 opacity-30" />
        </div>
        <div className="absolute top-32 right-1/4 animate-pulse delay-200">
          <Shield className="h-10 w-10 text-red-500 opacity-40" />
        </div>
        <div className="absolute top-16 right-16 animate-float delay-250">
          <CheckCircle className="h-9 w-9 text-green-500 opacity-35" />
        </div>
        
        {/* Additional Business Feature Icons */}
        <div className="absolute top-36 left-1/3 animate-pulse delay-400">
          <MessageCircle className="h-8 w-8 text-green-400 opacity-40" />
        </div>
        <div className="absolute bottom-36 right-1/3 animate-bounce delay-600">
          <Users className="h-11 w-11 text-red-400 opacity-30" />
        </div>
        <div className="absolute top-52 right-1/5 animate-float delay-800">
          <FileText className="h-9 w-9 text-white opacity-30" />
        </div>
        <div className="absolute bottom-52 left-1/5 animate-pulse delay-1000">
          <CheckCircle className="h-10 w-10 text-green-500 opacity-25" />
        </div>
        
        {/* Business Feature Labels as Background Images */}
        <div className="absolute top-28 left-16 animate-fade-in delay-300">
          <div className="bg-green-500/10 px-3 py-1 rounded-full backdrop-blur-sm border border-green-500/20">
            <span className="text-green-400 text-xs font-medium">Mensajería</span>
          </div>
        </div>
        <div className="absolute top-56 right-24 animate-fade-in delay-500">
          <div className="bg-red-500/10 px-3 py-1 rounded-full backdrop-blur-sm border border-red-500/20">
            <span className="text-red-400 text-xs font-medium">Clientes</span>
          </div>
        </div>
        <div className="absolute bottom-48 left-32 animate-fade-in delay-700">
          <div className="bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm border border-white/20">
            <span className="text-white text-xs font-medium">Archivos</span>
          </div>
        </div>
        <div className="absolute top-24 right-40 animate-fade-in delay-900">
          <div className="bg-green-500/10 px-3 py-1 rounded-full backdrop-blur-sm border border-green-500/20">
            <span className="text-green-500 text-xs font-medium">Automatización</span>
          </div>
        </div>
        <div className="absolute bottom-20 left-1/2 animate-fade-in delay-1100">
          <div className="bg-red-500/10 px-3 py-1 rounded-full backdrop-blur-sm border border-red-500/20">
            <span className="text-red-500 text-xs font-medium">Seguridad</span>
          </div>
        </div>
        
        {/* Business Chat Animation */}
        <div className="absolute top-1/3 right-1/3 animate-pulse delay-400">
          <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <MessageCircle className="h-6 w-6 text-green-400" />
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-100"></div>
              <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
        
        {/* Security Animation */}
        <div className="absolute bottom-1/3 left-1/3 animate-pulse delay-600">
          <div className="flex items-center space-x-2 bg-white/10 rounded-lg p-3 backdrop-blur-sm">
            <Shield className="h-6 w-6 text-red-400" />
            <CheckCircle className="h-4 w-4 text-green-400 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Main Login Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-4 animate-fade-in">
              WhatsApp Business
              <span className="block text-red-400">CRM Login</span>
            </h1>
            <p className="text-lg text-gray-300 mb-6">
              Accede a tu plataforma de comunicación empresarial
            </p>
            

          </div>

          {/* Login Card */}
          <Card className="bg-black/40 backdrop-blur-sm border border-red-500/30 animate-slide-up delay-500">
            <CardHeader className="space-y-1">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-full p-3 animate-glow">
                  <LogIn className="h-6 w-6 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl text-center text-white">Iniciar Sesión</CardTitle>
              <CardDescription className="text-center text-gray-300">
                Accede al sistema CRM con tu cuenta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-white">Usuario</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Ingresa tu usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="pl-10 bg-black/20 border-red-500/30 text-white placeholder:text-gray-400 focus:border-red-500"
                      disabled={isSubmitting || isLoading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-10 bg-black/20 border-red-500/30 text-white placeholder:text-gray-400 focus:border-red-500"
                      disabled={isSubmitting || isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive" className="bg-red-900/50 border-red-500/50">
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                  </Alert>
                )}

                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white border-0" 
                  disabled={isSubmitting || isLoading || !username || !password}
                >
                  {isSubmitting || isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Iniciando sesión...
                    </>
                  ) : (
                    <>
                      <LogIn className="mr-2 h-4 w-4" />
                      Iniciar Sesión
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-sm text-gray-400">
                  ¿No tienes acceso? Contacta al administrador del sistema
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Login;