import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaGallery, MediaItem } from '@/components/ui/MediaGallery';

export default function MediaGalleryPage() {
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Manejador para cuando se selecciona un archivo
  const handleMediaSelect = (media: MediaItem) => {
    setSelectedMedia(media);
  };

  // Formatear tamaño del archivo
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <>
      <Helmet>
        <title>Galería de Medios - CRM</title>
        <meta name="description" content="Gestión de archivos multimedia para el CRM" />
      </Helmet>

      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Galería de Medios</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Gestión de Archivos</CardTitle>
                <CardDescription>
                  Administra todos los archivos multimedia del sistema desde un solo lugar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MediaGallery 
                  onSelect={handleMediaSelect}
                  selectedMediaId={selectedMedia?.id}
                  showButton={false}
                />
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Información</CardTitle>
                <CardDescription>
                  Detalles sobre la galería y la media seleccionada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="preview">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">Vista Previa</TabsTrigger>
                    <TabsTrigger value="info">Información</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="space-y-4 pt-4">
                    {selectedMedia ? (
                      <div className="flex flex-col items-center">
                        {selectedMedia.type === 'image' ? (
                          <div className="border rounded-md overflow-hidden mb-4 w-full">
                            <img
                              src={selectedMedia.url}
                              alt={selectedMedia.title || selectedMedia.originalFilename}
                              className="w-full object-contain max-h-[300px]"
                            />
                          </div>
                        ) : (
                          <div className="border rounded-md p-6 text-center mb-4 w-full bg-gray-50">
                            <div className="text-4xl mb-2">
                              {selectedMedia.type === 'document' ? '📄' : 
                               selectedMedia.type === 'audio' ? '🔊' : 
                               selectedMedia.type === 'video' ? '🎬' : '📁'}
                            </div>
                            <p className="text-sm text-gray-500">
                              {selectedMedia.originalFilename}
                            </p>
                          </div>
                        )}
                        
                        <div className="w-full">
                          <h3 className="font-medium">{selectedMedia.title || selectedMedia.originalFilename}</h3>
                          {selectedMedia.description && (
                            <p className="text-sm text-gray-600 mt-1">{selectedMedia.description}</p>
                          )}
                          
                          <a 
                            href={selectedMedia.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
                          >
                            Abrir archivo
                          </a>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-5xl mb-3">🖼️</p>
                        <p>Selecciona un archivo para ver su vista previa</p>
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="info" className="space-y-4 pt-4">
                    {selectedMedia ? (
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Nombre Original</h3>
                          <p>{selectedMedia.originalFilename}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
                          <p className="capitalize">{selectedMedia.type}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Tamaño</h3>
                          <p>{formatFileSize(selectedMedia.size)}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">MIME Type</h3>
                          <p>{selectedMedia.mimeType}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Fecha de Subida</h3>
                          <p>{new Date(selectedMedia.uploadedAt).toLocaleString()}</p>
                        </div>
                        
                        {selectedMedia.lastUsedAt && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Último Uso</h3>
                            <p>{new Date(selectedMedia.lastUsedAt).toLocaleString()}</p>
                          </div>
                        )}
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Usos</h3>
                          <p>{selectedMedia.useCount}</p>
                        </div>
                        
                        {selectedMedia.tags && selectedMedia.tags.length > 0 && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Etiquetas</h3>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {selectedMedia.tags.map((tag, i) => (
                                <span key={i} className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p className="text-5xl mb-3">📋</p>
                        <p>Selecciona un archivo para ver su información</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Guía de Uso</CardTitle>
                <CardDescription>
                  Cómo usar la galería de medios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium">Subir archivos</h3>
                  <p className="text-sm text-gray-600">
                    Utiliza el botón "Subir Archivo" para agregar nuevos elementos a la galería.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Categorización</h3>
                  <p className="text-sm text-gray-600">
                    Asigna etiquetas a tus archivos para organizarlos mejor y facilitar su búsqueda.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-medium">Integración con el CRM</h3>
                  <p className="text-sm text-gray-600">
                    Los archivos de la galería pueden ser utilizados en mensajes, notas, y perfiles de clientes.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}