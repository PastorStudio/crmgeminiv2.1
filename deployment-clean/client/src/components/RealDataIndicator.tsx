import { CheckCircle, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RealDataIndicatorProps {
  isRealData?: boolean;
  count?: number;
  label?: string;
}

export function RealDataIndicator({ isRealData = false, count, label = "items" }: RealDataIndicatorProps) {
  if (!isRealData) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-green-600">
      <Database className="h-4 w-4" />
      <span>Real WhatsApp Data</span>
      {count !== undefined && (
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          {count} {label}
        </Badge>
      )}
      <CheckCircle className="h-4 w-4" />
    </div>
  );
}