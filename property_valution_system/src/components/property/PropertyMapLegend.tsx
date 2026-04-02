import { CircleDotDashed, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getPropertyTypeIconSvg } from "@/lib/mapHelpers";

type StatusOption = {
  value: string;
  label: string;
};

type BadgeVariant =
  | "default"
  | "secondary"
  | "info"
  | "outline"
  | "success"
  | "warning"
  | "destructive";

type PropertyTypeConfig = {
  variant: BadgeVariant;
};

const PROPERTY_TYPE_CONFIG: Record<string, PropertyTypeConfig> = {
  "Vacant Land": { variant: "warning" },
  "Agricultural Land": { variant: "success" },
  "Agricultural Property": { variant: "success" },
  "Commercial Building": { variant: "info" },
  "Commercial Property": { variant: "info" },
  "Industrial Property": { variant: "warning" },
  "Residential Building": { variant: "secondary" },
  "Residential Property": { variant: "secondary" },
  "Specialized Property": { variant: "destructive" },
};

const getPropertyTypeBadgeConfig = (typeName: string): PropertyTypeConfig => {
  return PROPERTY_TYPE_CONFIG[typeName] ?? { variant: "outline" };
};

const propertyTypeStyles: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  secondary: "bg-secondary text-secondary-foreground border-border",
  info: "bg-blue-50 text-blue-700 border-blue-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  destructive: "bg-red-50 text-red-700 border-red-200",
  outline: "bg-muted text-muted-foreground border-border",
};

interface PropertyMapLegendProps {
  statusOptions: StatusOption[];
  propertyTypes?: string[];
}

export function PropertyMapLegend({
  statusOptions,
  propertyTypes = [],
}: PropertyMapLegendProps) {
  return (
    <Card className="p-4 border border-border shadow-sm rounded-xl bg-card/70">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <MapPin className="h-4 w-4" /> Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground inline-flex items-center justify-center shadow-sm border border-border ring-1 ring-background">
              <CircleDotDashed className="h-3.5 w-3.5" />
            </span>
            <span className="text-muted-foreground font-medium">Property Pin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-orange-400 text-primary-foreground inline-flex items-center justify-center shadow-sm border border-primary/20 ring-1 ring-background">
              <CircleDotDashed className="h-3.5 w-3.5" />
            </span>
            <span className="text-muted-foreground font-medium">
              Property Valuation Pin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-red-600 text-primary-foreground inline-flex items-center justify-center shadow-sm border border-red-800/30 ring-1 ring-background">
              <CircleDotDashed className="h-3.5 w-3.5" />
            </span>
            <span className="text-muted-foreground font-medium">
              Indicative Valuation Pin
            </span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          A property can now show multiple pins at the same location area when it has approved active valuation records.
        </div>

        {propertyTypes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Property Types
            </div>
            {propertyTypes.map((typeName) => {
              const { variant } = getPropertyTypeBadgeConfig(typeName);
              const iconSvg = getPropertyTypeIconSvg(typeName, { size: 12 });
              return (
                <span
                  key={typeName}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${propertyTypeStyles[variant]}`}
                >
                  <span
                    className="inline-flex items-center text-current"
                    dangerouslySetInnerHTML={{ __html: iconSvg }}
                  />
                  {typeName}
                </span>
              );
            })}
          </div>
        )}

        <div className="h-px w-full bg-border" />

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </div>
          {statusOptions.map((status) => {
            let colorClass = "bg-gray-500";
            if (status.value === "ACTIVE") colorClass = "bg-green-500";
            if (status.value === "SOLD") colorClass = "bg-blue-500";
            if (status.value === "RENTED") colorClass = "bg-orange-500";
            if (status.value === "RENTAL_SALE") colorClass = "bg-yellow-500";

            return (
              <div key={status.value} className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${colorClass} shadow-sm ring-2 ring-background`}
                />
                <span className="text-muted-foreground font-medium">{status.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
