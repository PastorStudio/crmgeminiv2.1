import React from 'react';
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  size?: "sm" | "md" | "lg";
  centered?: boolean;
}

export function Spinner({ className, size = "md", centered = false, ...props }: SpinnerProps) {
  // Tamaños predefinidos para el spinner
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  // Clases para centrado
  const centeredClasses = centered 
    ? "flex items-center justify-center" 
    : "";

  return (
    <div className={cn(centeredClasses, className)} {...props}>
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
    </div>
  );
}