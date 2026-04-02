import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function TransactionTab({
  formData,
  onInputChange,
  onReset,
  t,
  tc: _tc,
}: TransactionTabProps) {
  const selectedTransactionType =
    normalizeTransactionType(formData.transactionType) ?? "";

  return (
    <Card>
      <CardHeader className="flex  justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-blue-600" />
          <CardTitle>{t("transactionInformation")}</CardTitle>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
        >
          <RotateCcw className="h-4 w-4" />
          Clear Tab
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transactionType">
              {t("transactionType")} <span className="text-red-500">*</span>
            </Label>
            <Select
              value={selectedTransactionType}
              onValueChange={(value) => onInputChange("transactionType", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Transaction Type" />
              </SelectTrigger>
              <SelectContent>
                {TRANSACTION_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction Date */}
          <div className="space-y-2">
            <Label htmlFor="transactionDate">
              {t("transactionDate")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="transactionDate"
              type="date"
              value={formData.transactionDate}
              onChange={(e) => onInputChange("transactionDate", e.target.value)}
            />
          </div>

          {/* Total Price */}
          <div className="space-y-2">
            <Label htmlFor="totalPrice">
              {t("totalPrice")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="totalPrice"
              type="number"
              value={formData.totalPrice}
              onChange={(e) => onInputChange("totalPrice", e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
