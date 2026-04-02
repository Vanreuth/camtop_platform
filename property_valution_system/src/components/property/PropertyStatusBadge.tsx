"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  Home,
  DollarSign,
  Key,
  FileText,
  Activity,
  Ban,
} from "lucide-react";

// Property Status - business/transaction states
export type PropertyStatusType = "SOLD" | "RENTED" | "RENTAL_SALE" | "ACTIVE" | "INACTIVE";

// Workflow Status - workflow states
export type WorkflowStatusType = "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";

type PropertyStatusBadgeProps = {
  status: PropertyStatusType | string;
  className?: string;
  showIcon?: boolean;
};

type WorkflowStatusBadgeProps = {
  status: WorkflowStatusType | string;
  className?: string;
  showIcon?: boolean;
};

// Configuration for Property Status (business states)
const propertyStatusConfig: Record<
  PropertyStatusType,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    className: string;
  }
> = {
  ACTIVE: {
    label: "Active",
    variant: "default",
    icon: Activity,
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  INACTIVE: {
    label: "Inactive",
    variant: "secondary",
    icon: Ban,
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
  SOLD: {
    label: "Sold",
    variant: "secondary",
    icon: DollarSign,
    className: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  },
  RENTED: {
    label: "Rented",
    variant: "secondary",
    icon: Key,
    className: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  },
  RENTAL_SALE: {
    label: "Rental/Sale",
    variant: "secondary",
    icon: DollarSign,
    className: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
  },
};

// Configuration for Workflow Status
const workflowStatusConfig: Record<
  WorkflowStatusType,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    className: string;
  }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: FileText,
    className: "bg-gray-100 text-gray-800 hover:bg-gray-100",
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    variant: "outline",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
  },
  APPROVED: {
    label: "Approved",
    variant: "default",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 hover:bg-green-100",
  },
  REJECTED: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
    className: "bg-red-100 text-red-800 hover:bg-red-100",
  },
  ARCHIVED: {
    label: "Archived",
    variant: "secondary",
    icon: Archive,
    className: "bg-slate-100 text-slate-800 hover:bg-slate-100",
  },
};

/**
 * Badge component for Property Status (business states)
 */
export function PropertyStatusBadge({
  status,
  className,
  showIcon = true,
}: PropertyStatusBadgeProps) {
  const config = propertyStatusConfig[status as PropertyStatusType] || {
    label: status,
    variant: "outline" as const,
    icon: Home,
    className: "",
  };

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className, "font-medium")}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

/**
 * Badge component for Workflow Status
 */
export function WorkflowStatusBadge({
  status,
  className,
  showIcon = true,
}: WorkflowStatusBadgeProps) {
  const config = workflowStatusConfig[status as WorkflowStatusType] || {
    label: status,
    variant: "outline" as const,
    icon: FileText,
    className: "",
  };

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className, "font-medium")}
    >
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      {config.label}
    </Badge>
  );
}

/**
 * Hook to get property status information
 */
export function usePropertyStatus(status: string) {
  const config = propertyStatusConfig[status as PropertyStatusType];

  return {
    label: config?.label || status,
    variant: config?.variant || "outline",
    className: config?.className || "",
    icon: config?.icon || Home,
    isActive: status === "ACTIVE",
    isInactive: status === "INACTIVE",
    isSold: status === "SOLD",
    isRented: status === "RENTED",
    isRentalSale: status === "RENTAL_SALE",
  };
}

/**
 * Hook to get workflow status information
 */
export function useWorkflowStatus(workflowStatus: string) {
  const config = workflowStatusConfig[workflowStatus as WorkflowStatusType];

  return {
    label: config?.label || workflowStatus,
    variant: config?.variant || "outline",
    className: config?.className || "",
    icon: config?.icon || FileText,
    isDraft: workflowStatus === "DRAFT",
    isPendingReview: workflowStatus === "PENDING_REVIEW",
    isApproved: workflowStatus === "APPROVED",
    isRejected: workflowStatus === "REJECTED",
    isArchived: workflowStatus === "ARCHIVED",
    canSubmit: workflowStatus === "DRAFT" || workflowStatus === "REJECTED",
    canApprove: workflowStatus === "PENDING_REVIEW",
    canReject: workflowStatus === "PENDING_REVIEW",
  };
}
