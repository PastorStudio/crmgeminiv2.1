import { IntelligentResponseTester } from '@/components/IntelligentResponseTester';

export default function IntelligentResponseTest() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pruebas de Respuestas Inteligentes</h1>
        <p className="text-muted-foreground mt-2">
          Sistema avanzado de respuestas AI que utiliza el prompt personalizado configurado 
          y mantiene el historial de conversación para generar respuestas contextuales y persuasivas.
        </p>
      </div>
      
      <IntelligentResponseTester />
    </div>
  );
}