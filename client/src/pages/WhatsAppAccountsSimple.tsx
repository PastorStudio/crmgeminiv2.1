import { WhatsAppAccountsList } from '@/components/WhatsAppAccountsList';

export default function WhatsAppAccountsSimple() {
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Cuentas de WhatsApp</h1>
        <p className="text-muted-foreground">
          Gestione sus cuentas de WhatsApp conectadas al sistema
        </p>
      </div>
      
      <WhatsAppAccountsList />
    </div>
  );
}