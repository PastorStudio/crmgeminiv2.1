import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid, Smartphone } from 'lucide-react';

interface UnifiedViewToggleProps {
  viewMode: 'single' | 'all';
  onToggle: () => void;
  className?: string;
}

export function UnifiedViewToggle({ viewMode, onToggle, className = '' }: UnifiedViewToggleProps) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={`flex items-center ${className}`}
      title={viewMode === 'single' ? 'Ver todas las cuentas' : 'Ver cuenta individual'}
      onClick={onToggle}
    >
      {viewMode === 'single' ? (
        <>
          <LayoutGrid className="h-4 w-4 mr-1" />
          <span className="text-xs">Unificada</span>
        </>
      ) : (
        <>
          <Smartphone className="h-4 w-4 mr-1" />
          <span className="text-xs">Individual</span>
        </>
      )}
    </Button>
  );
}