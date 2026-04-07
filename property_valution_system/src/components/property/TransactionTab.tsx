import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, RotateCcw } from "lucide-react";
import { PropertyFormData } from "@/types/property.types";
import {
  TRANSACTION_TYPE_OPTIONS,
  normalizeTransactionType,
} from "@/constants/transactionOptions";

interface TransactionTabProps {
  formData: PropertyFormData;
  onInputChange: (field: string, value: any) => void;
  onReset: () => void;
  referenceArea?: number;
  fieldErrors?: Partial<Record<string, string>>;
  onClearFieldError?: (field: string) => void;
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function TransactionTab({
  formData,
  onInputChange,
  onReset,
  fieldErrors,
  onClearFieldError,
  t,
  tc,
}: TransactionTabProps) {
  const selectedTransactionType =
    normalizeTransactionType(formData.transactionType) ?? "";

  const renderRequiredLabel = (label: string) => (
    <>
      {label} <span className="text-destructive">*</span>
    </>
  );

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <DollarSign className="h-5 w-5 text-primary" />
              {t("transactionInformation")} <span className="text-destructive">*</span>
            </CardTitle>
            <CardDescription className="mt-2">
              {t("transactionInformationDescription")}
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <RotateCcw className="h-4 w-4" />
            {tc("clear")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transactionType">{renderRequiredLabel(t("transactionType"))}</Label>
            <Select
              value={selectedTransactionType}
              onValueChange={(value) => {
                onInputChange("transactionType", value);
                onClearFieldError?.("transactionType");
              }}
            >
              <SelectTrigger
                id="transactionType"
                className={`h-11 ${fieldErrors?.transactionType ? "border-destructive" : ""}`}
              >
                <SelectValue placeholder={t("transactionTypePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors?.transactionType ? (
              <p className="text-sm text-destructive">{fieldErrors.transactionType}</p>
            ) : null}
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transactionDate">{renderRequiredLabel(t("transactionDate"))}</Label>
            <Input
              id="transactionDate"
              type="date"
              value={formData.transactionDate}
              className={`h-11 ${fieldErrors?.transactionDate ? "border-destructive" : ""}`}
              required
              onChange={(e) => {
                onInputChange("transactionDate", e.target.value);
                onClearFieldError?.("transactionDate");
              }}
            />
            {fieldErrors?.transactionDate ? (
              <p className="text-sm text-destructive">{fieldErrors.transactionDate}</p>
            ) : null}
          </div>

          {/* Total Price */}
          <div className="space-y-2">
            <Label htmlFor="totalPrice">{renderRequiredLabel(t("totalPrice"))}</Label>
            <Input
              id="totalPrice"
              type="number"
              value={formData.totalPrice}
              className={`h-11 ${fieldErrors?.totalPrice ? "border-destructive" : ""}`}
              min="0"
              required
              onChange={(e) => {
                onInputChange("totalPrice", e.target.value);
                onClearFieldError?.("totalPrice");
              }}
              placeholder={t("totalPricePlaceholder")}
            />
            {fieldErrors?.totalPrice ? (
              <p className="text-sm text-destructive">{fieldErrors.totalPrice}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
