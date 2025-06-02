import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import SalesPipelineKanban from "@/components/leads/SalesPipelineKanban";

export default function SalesPipeline() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-600 mt-1">
            Gestiona tu pipeline de ventas con el sistema Kanban de 6 etapas
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Nuevo Lead</span>
          </Button>
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Nuevos</p>
                <p className="text-2xl font-bold text-blue-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Nuevo
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Asignados</p>
                <p className="text-2xl font-bold text-purple-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                Asignado
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contactados</p>
                <p className="text-2xl font-bold text-yellow-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                Contactado
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Negociación</p>
                <p className="text-2xl font-bold text-orange-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                Negociando
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completados</p>
                <p className="text-2xl font-bold text-green-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Completado
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">No Interesados</p>
                <p className="text-2xl font-bold text-red-600">-</p>
              </div>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Rechazado
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <SalesPipelineKanban />
    </div>
  );
}