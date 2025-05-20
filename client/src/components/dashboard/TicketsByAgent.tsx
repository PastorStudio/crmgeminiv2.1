import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type AgentTicketStats = {
  agent_id: number;
  agent_name: string;
  department: string;
  pending_tickets: number;
  resolved_tickets: number;
  canceled_tickets: number;
  total_tickets: number;
  avg_resolution_time_hours: number;
};

type TicketsByAgentData = {
  agentStats: AgentTicketStats[];
  totals: {
    total_tickets: number;
    total_pending: number;
    total_resolved: number;
    total_canceled: number;
  };
  categoryDistribution: { category: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
};

// Mapeo de categorías para mostrar nombres más amigables
const categoryLabels: Record<string, string> = {
  soporte: "Soporte",
  ventas: "Ventas",
  facturacion: "Facturación",
  tecnico: "Técnico",
  consulta: "Consulta",
  finanzas: "Finanzas"
};

// Mapeo de estados para mostrar nombres más amigables
const statusLabels: Record<string, string> = {
  nuevo: "Nuevo",
  en_progreso: "En Progreso",
  resuelto: "Resuelto",
  cancelado: "Cancelado",
  sin_asignar: "Sin Asignar"
};

export default function TicketsByAgent() {
  const { data, isLoading, error } = useQuery<TicketsByAgentData>({
    queryKey: ["/api/dashboard/tickets-by-agent"],
    refetchInterval: 30000 // Actualizar cada 30 segundos
  });

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Tickets por Agente</CardTitle>
          <CardDescription>Distribución y rendimiento de tickets por agente</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="col-span-full">
        <CardHeader>
          <CardTitle>Tickets por Agente</CardTitle>
          <CardDescription>Distribución y rendimiento de tickets por agente</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">
            Error al cargar las estadísticas de tickets. Por favor, intente de nuevo más tarde.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  // Asegurar que agentStats sea un array si no lo es
  const agentStats = Array.isArray(data.agentStats) ? data.agentStats : [];
  const totals = data.totals || {
    total_tickets: 0,
    total_pending: 0,
    total_resolved: 0,
    total_canceled: 0
  };
  const categoryDistribution = Array.isArray(data.categoryDistribution) ? data.categoryDistribution : [];
  const statusDistribution = Array.isArray(data.statusDistribution) ? data.statusDistribution : [];

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle>Rendimiento de Agentes en Tickets</CardTitle>
        <CardDescription>Distribución de tickets pendientes vs. resueltos por agente</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total de Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.totals.total_tickets}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tickets Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.totals.total_pending}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round((data.totals.total_pending / (data.totals.total_tickets || 1)) * 100)}% del total
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Tickets Resueltos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{data.totals.total_resolved}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round((data.totals.total_resolved / (data.totals.total_tickets || 1)) * 100)}% del total
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabla de estadísticas por agente */}
        <h3 className="text-lg font-semibold mb-3">Distribución por Agente</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead>Pendientes</TableHead>
                <TableHead>Resueltos</TableHead>
                <TableHead>Cancelados</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>% Resolución</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4">
                    No hay datos disponibles
                  </TableCell>
                </TableRow>
              ) : (
                agentStats.map((stat) => {
                  const resolutionRate = Math.round(
                    (stat.resolved_tickets / (stat.total_tickets || 1)) * 100
                  );
                  return (
                    <TableRow key={stat.agent_id}>
                      <TableCell className="font-medium">{stat.agent_name}</TableCell>
                      <TableCell>{stat.pending_tickets}</TableCell>
                      <TableCell>{stat.resolved_tickets}</TableCell>
                      <TableCell>{stat.canceled_tickets}</TableCell>
                      <TableCell>{stat.total_tickets}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={resolutionRate} className="w-[60px]" />
                          <span className="text-sm">{resolutionRate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Estadísticas adicionales */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Distribución por Categoría */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Por Categoría</h3>
            <div className="space-y-2">
              {categoryDistribution.map(({ category, count }) => (
                <div key={category} className="flex justify-between items-center">
                  <span>{categoryLabels[category] || category}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Distribución por Estado */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Por Estado</h3>
            <div className="space-y-2">
              {statusDistribution.map(({ status, count }) => (
                <div key={status} className="flex justify-between items-center">
                  <span>{statusLabels[status] || status}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}