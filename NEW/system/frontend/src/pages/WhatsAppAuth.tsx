import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface QRResponse {
  qrcode: string;
  qrDataUrl?: string;
}

interface AuthStatus {
  authenticated: boolean;
  ready: boolean;
  initialized: boolean;
  hasClient: boolean;
}

export default function WhatsAppAuth() {
  const [accountId] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  // Query for QR code
  const { data: qrData, isLoading: qrLoading, refetch: refetchQR } = useQuery<QRResponse>({
    queryKey: ['whatsapp-qr', accountId, refreshKey],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/qr`);
      if (!response.ok) throw new Error('Failed to get QR code');
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Query for authentication status
  const { data: authStatus, refetch: refetchAuth } = useQuery<AuthStatus>({
    queryKey: ['whatsapp-auth-status', accountId],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp-accounts/${accountId}/auth-status`);
      if (!response.ok) throw new Error('Failed to get auth status');
      return response.json();
    },
    refetchInterval: 2000, // Check status every 2 seconds
  });

  const handleRefreshQR = async () => {
    try {
      await fetch(`/api/whatsapp-accounts/${accountId}/refresh-qr`, { method: 'POST' });
      setRefreshKey(prev => prev + 1);
      await refetchQR();
    } catch (error) {
      console.error('Error refreshing QR:', error);
    }
  };

  const handleForceAuth = async () => {
    try {
      await fetch(`/api/whatsapp-accounts/${accountId}/force-auth`, { method: 'POST' });
      await refetchAuth();
    } catch (error) {
      console.error('Error forcing auth:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-950 via-black to-red-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            WhatsApp Authentication
          </h1>
          <p className="text-red-200 text-lg">
            Scan the QR code with your WhatsApp mobile app to connect real data
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Code Card */}
          <Card className="bg-black/40 border-red-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-red-400" />
                QR Code Scanner
              </CardTitle>
              <CardDescription className="text-red-200">
                Use your phone's WhatsApp app to scan this code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrLoading ? (
                <div className="flex items-center justify-center h-64 bg-white/10 rounded-lg">
                  <RefreshCw className="h-8 w-8 text-red-400 animate-spin" />
                </div>
              ) : qrData?.qrDataUrl ? (
                <div className="bg-white p-4 rounded-lg">
                  <img 
                    src={qrData.qrDataUrl} 
                    alt="WhatsApp QR Code" 
                    className="w-full h-auto max-w-64 mx-auto"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-white/10 rounded-lg text-red-200">
                  No QR code available
                </div>
              )}
              
              <Button 
                onClick={handleRefreshQR}
                variant="outline"
                className="w-full border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh QR Code
              </Button>
            </CardContent>
          </Card>

          {/* Status Card */}
          <Card className="bg-black/40 border-red-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                {authStatus?.authenticated ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                Connection Status
              </CardTitle>
              <CardDescription className="text-red-200">
                Real-time WhatsApp connection status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-white">Initialized:</span>
                  <span className={authStatus?.initialized ? "text-green-400" : "text-red-400"}>
                    {authStatus?.initialized ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-white">Authenticated:</span>
                  <span className={authStatus?.authenticated ? "text-green-400" : "text-red-400"}>
                    {authStatus?.authenticated ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-white">Ready:</span>
                  <span className={authStatus?.ready ? "text-green-400" : "text-red-400"}>
                    {authStatus?.ready ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-white">Client Active:</span>
                  <span className={authStatus?.hasClient ? "text-green-400" : "text-red-400"}>
                    {authStatus?.hasClient ? "✓ Yes" : "✗ No"}
                  </span>
                </div>
              </div>

              {authStatus?.authenticated ? (
                <div className="bg-green-900/30 border border-green-600 rounded-lg p-4">
                  <p className="text-green-200 text-center font-medium">
                    ✓ WhatsApp Connected Successfully!
                  </p>
                  <p className="text-green-300 text-sm text-center mt-2">
                    Real data is now available in the dashboard
                  </p>
                </div>
              ) : (
                <div className="bg-red-900/30 border border-red-600 rounded-lg p-4">
                  <p className="text-red-200 text-center font-medium">
                    Waiting for WhatsApp Authentication
                  </p>
                  <p className="text-red-300 text-sm text-center mt-2">
                    Scan the QR code with your mobile WhatsApp
                  </p>
                </div>
              )}

              <Button 
                onClick={handleForceAuth}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
              >
                Force Authentication Check
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="mt-6 bg-black/40 border-red-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">Authentication Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-red-200">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400 mb-2">1</div>
                <p>Open WhatsApp on your mobile device</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400 mb-2">2</div>
                <p>Go to Settings → Linked Devices → Link a Device</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400 mb-2">3</div>
                <p>Scan the QR code shown above</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}