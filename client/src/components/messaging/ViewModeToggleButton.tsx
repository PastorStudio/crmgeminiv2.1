import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Smartphone } from 'lucide-react';

interface ViewModeToggleButtonProps {
  viewMode: 'single' | 'all';
  onToggle: (mode: 'single' | 'all') => void;
}

export function ViewModeToggleButton({ viewMode, onToggle }: ViewModeToggleButtonProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      className="ml-2 flex items-center"
      title={viewMode === 'single' ? 'Ver todas las cuentas' : 'Ver cuenta individual'}
      onClick={() => onToggle(viewMode === 'single' ? 'all' : 'single')}
    >
      {viewMode === 'single' ? (
        <LayoutGrid className="h-4 w-4" />
      ) : (
        <Smartphone className="h-4 w-4" />
      )}
    </Button>
  );
}