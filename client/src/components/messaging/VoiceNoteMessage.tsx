import React, { useEffect, useState } from 'react';
import { Mic, FileText, Loader2 } from 'lucide-react';

interface VoiceNoteMessageProps {
  messageId: string;
}

export const VoiceNoteMessage: React.FC<VoiceNoteMessageProps> = ({ messageId }) => {
  const [transcription, setTranscription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTranscription = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`📝 Cargando transcripción para mensaje ${messageId}...`);
        
        const response = await fetch(`/api/voice-transcriptions/${messageId}`);
        const data = await response.json();
        
        if (data.success && data.transcription) {
          setTranscription(data.transcription);
          console.log(`✅ Transcripción cargada: "${data.transcription}"`);
        } else {
          setError('Transcripción no disponible');
          console.log(`❌ Transcripción no encontrada para mensaje ${messageId}`);
        }
      } catch (err) {
        console.error('❌ Error cargando transcripción:', err);
        setError('Error cargando transcripción');
      } finally {
        setLoading(false);
      }
    };

    fetchTranscription();
  }, [messageId]);

  return (
    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
      <div className="flex items-center gap-2 mb-2">
        <Mic className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium text-green-700">Nota de voz</span>
      </div>
      
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Cargando transcripción...</span>
          </div>
        ) : error ? (
          <div className="text-red-600 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>{error}</span>
          </div>
        ) : transcription ? (
          <div className="bg-white p-2 rounded border">
            <div className="flex items-start gap-2">
              <FileText className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-800 leading-relaxed">
                "{transcription}"
              </p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">
            Transcripción no disponible
          </div>
        )}
      </div>
    </div>
  );
};