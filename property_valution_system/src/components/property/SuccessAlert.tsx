import React from "react";
import { CheckCircle2 } from "lucide-react";

interface SuccessAlertProps {
  title: string;
  description: string;
}

export function SuccessAlert({ title, description }: SuccessAlertProps) {
  return (
    <div className="max-w-8xl mx-auto px-4 py-4">
      <div className="border border-green-200 rounded-lg p-4 flex items-center gap-3 bg-green-50">
        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        <div>
          <p className="font-medium text-green-900">{title}</p>
          <p className="text-sm text-green-700">{description}</p>
        </div>
      </div>
    </div>
  );
}
