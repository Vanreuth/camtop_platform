import * as React from "react";
import { cn } from "../../lib/utils";

export const FieldGroup = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("space-y-2", className)} {...props} />
);

export const FieldLabel = ({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label
    className={cn("text-sm font-medium text-foreground", className)}
    {...props}
  />
);

export const FieldDescription = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-xs text-muted-foreground", className)} {...props} />
);

export const FieldSeparator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHRElement>) => (
  <hr className={cn("my-2 border-border", className)} {...props} />
);

export const Field = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col gap-1", className)} {...props} />
);
