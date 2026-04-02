import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Save, Loader2 } from "lucide-react";

interface PropertyPageHeaderProps {
  title: string;
  subtitle: string;
  isSubmitting: boolean;
  onSubmit: () => void;
  submitButtonText: string;
  savingText: string;
  onBack?: () => void;
  backButtonAriaLabel?: string;
}

export function PropertyPageHeader({
  title,
  subtitle,
  isSubmitting,
  onSubmit,
  submitButtonText,
  savingText,
  onBack,
  backButtonAriaLabel = "Back",
}: PropertyPageHeaderProps) {
  return (
    <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-8xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="rounded-full"
                aria-label={backButtonAriaLabel}
                type="button"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                {title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {subtitle}
              </p>
            </div>
          </div>
          <Button
            onClick={onSubmit}
            size="lg"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {savingText}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {submitButtonText}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
