import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Play, Pause, Volume2, VolumeX, FileText, Image, Video, Music, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MediaFile {
  id: number;
  fileName: string;
  fileType: string;
  mimeType: string;
  fileSize?: number;
  fileUrl: string;
  thumbnailPath?: string;
  messageId?: string;
  createdAt: string;
}

interface MultimediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaFile: MediaFile | null;
  onDownload?: (file: MediaFile) => void;
}

export default function MultimediaViewer({ isOpen, onClose, mediaFile, onDownload }: MultimediaViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      if (audioRef) {
        audioRef.pause();
        audioRef.currentTime = 0;
      }
      if (videoRef) {
        videoRef.pause();
        videoRef.currentTime = 0;
      }
    }
  }, [isOpen, audioRef, videoRef]);

  if (!mediaFile) return null;

  const handleDownload = async () => {
    try {
      if (onDownload) {
        onDownload(mediaFile);
      } else {
        // Default download implementation
        const response = await fetch(`/api/media/${mediaFile.id}/download`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = mediaFile.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
      
      toast({
        title: "Descarga iniciada",
        description: `Descargando ${mediaFile.fileName}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo descargar el archivo",
        variant: "destructive",
      });
    }
  };

  const togglePlay = () => {
    if (mediaFile.fileType === 'audio' && audioRef) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setIsPlaying(!isPlaying);
    } else if (mediaFile.fileType === 'video' && videoRef) {
      if (isPlaying) {
        videoRef.pause();
      } else {
        videoRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (audioRef) {
      audioRef.muted = !isMuted;
      setIsMuted(!isMuted);
    } else if (videoRef) {
      videoRef.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Tamaño desconocido';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'image':
        return <Image className="h-6 w-6" />;
      case 'video':
        return <Video className="h-6 w-6" />;
      case 'audio':
        return <Music className="h-6 w-6" />;
      case 'document':
        return <FileText className="h-6 w-6" />;
      default:
        return <File className="h-6 w-6" />;
    }
  };

  const renderMediaContent = () => {
    switch (mediaFile.fileType) {
      case 'image':
        return (
          <div className="flex justify-center">
            <img
              src={mediaFile.fileUrl}
              alt={mediaFile.fileName}
              className="max-w-full max-h-96 object-contain rounded-lg"
              onError={(e) => {
                e.currentTarget.src = '/placeholder-image.png';
              }}
            />
          </div>
        );
      
      case 'video':
        return (
          <div className="flex justify-center">
            <video
              ref={setVideoRef}
              src={mediaFile.fileUrl}
              className="max-w-full max-h-96 rounded-lg"
              controls
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
            >
              Tu navegador no soporta videos.
            </video>
          </div>
        );
      
      case 'audio':
        return (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-full p-8">
              <Music className="h-16 w-16 text-white" />
            </div>
            <audio
              ref={setAudioRef}
              src={mediaFile.fileUrl}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onVolumeChange={(e) => setIsMuted(e.currentTarget.muted)}
            >
              Tu navegador no soporta audio.
            </audio>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePlay}
                className="flex items-center space-x-2"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isPlaying ? 'Pausar' : 'Reproducir'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMute}
                className="flex items-center space-x-2"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                <span>{isMuted ? 'Activar' : 'Silenciar'}</span>
              </Button>
            </div>
          </div>
        );
      
      case 'document':
        return (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gradient-to-r from-green-500 to-blue-600 rounded-full p-8">
              <FileText className="h-16 w-16 text-white" />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Vista previa no disponible para este tipo de documento.
              Descarga el archivo para verlo.
            </p>
          </div>
        );
      
      default:
        return (
          <div className="flex flex-col items-center space-y-4">
            <div className="bg-gradient-to-r from-gray-500 to-gray-600 rounded-full p-8">
              <File className="h-16 w-16 text-white" />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Vista previa no disponible para este tipo de archivo.
              Descarga el archivo para abrirlo.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            {getFileIcon(mediaFile.fileType)}
            <span className="truncate">{mediaFile.fileName}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* File metadata */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {mediaFile.fileType.toUpperCase()}
            </Badge>
            <Badge variant="outline">
              {mediaFile.mimeType}
            </Badge>
            {mediaFile.fileSize && (
              <Badge variant="outline">
                {formatFileSize(mediaFile.fileSize)}
              </Badge>
            )}
            <Badge variant="outline">
              {new Date(mediaFile.createdAt).toLocaleDateString()}
            </Badge>
          </div>

          {/* Media content */}
          <div className="bg-gray-50 rounded-lg p-6">
            {renderMediaContent()}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center">
            <div className="flex space-x-2">
              <Button
                onClick={handleDownload}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Descargar</span>
              </Button>
            </div>
            
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}