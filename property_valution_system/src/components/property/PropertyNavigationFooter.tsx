import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface PropertyNavigationFooterProps {
  currentTab: string;
  isSubmitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  stepLabel?: string;
  isFirstStep?: boolean;
  isLastStep?: boolean;
  savingText?: string;
  translations: {
    previous: string;
    next: string;
    createProperty: string;
  };
}

export function PropertyNavigationFooter({
  currentTab,
  isSubmitting,
  onPrevious,
  onNext,
  onSubmit,
  stepLabel,
  isFirstStep,
  isLastStep,
  savingText = "Saving...",
  translations,
}: PropertyNavigationFooterProps) {
  const getStepLabel = () => {
    switch (currentTab) {
      case "basic":
        return "Step 1 of 6";
      case "details":
        return "Step 2 of 6";
      case "address":
        return "Step 3 of 6";
      case "documents":
        return "Step 4 of 6";
      case "source":
        return "Step 5 of 6";
      case "transaction":
        return "Step 6 of 6";
      default:
        return "";
    }
  };

  const resolvedStepLabel = stepLabel ?? getStepLabel();
  const previousDisabled = isFirstStep ?? currentTab === "basic";
  const showSubmit = isLastStep ?? currentTab === "transaction";

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={onPrevious}
            disabled={previousDisabled || isSubmitting}
            className="bg-primary hover:bg-primary/90 text-primary-foreground border-transparent"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {translations.previous}
          </Button>

          <Badge variant="outline" className="text-sm">
            {resolvedStepLabel}
          </Badge>

          {!showSubmit ? (
            <Button
              onClick={onNext}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {translations.next}
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              size="lg"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {savingText}
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {translations.createProperty}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
