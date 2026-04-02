import { Building, Loader2 } from "lucide-react";

interface PropertyMapHeaderProps {
  title: string;
  description: string;
  totalProperties: number;
  isLoading: boolean;
}

export function PropertyMapHeader({
  title,
  description,
  totalProperties,
  isLoading,
}: PropertyMapHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Building className="h-5 w-5 text-primary" />
          {title}
        </h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/70 shadow-sm">
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">
            Total Properties
          </span>
          <span className="text-xl font-bold text-foreground leading-none">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin inline text-primary" />
            ) : (
              totalProperties
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
