"use client";

import type { Control } from "react-hook-form";
import { DollarSign, Receipt, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/hooks/indicativeValuation/indicativeValuation.form";

type TranslationFn = (key: string, values?: Record<string, string | number>) => string;

type IndicativeValuationFinancialPanelProps = {
  control: Control<any>;
  disabled?: boolean;
  currency?: string;
  totalMinMarketValue: number;
  totalMaxMarketValue: number;
  accessValueRangeLabel: string;
  chargeFeeRangeLabel: string;
  forcedSaleValue: number;
  feeRateValue: number;
  discountValue: number;
  forcedSalePercentValue: number;
  automaticAccessValue: boolean;
  t: TranslationFn;
};

const metricCardClassName = "border-slate-200/80 bg-white/90 shadow-sm";

export function IndicativeValuationFinancialPanel({
  control,
  disabled = false,
  currency = "USD",
  totalMinMarketValue,
  totalMaxMarketValue,
  accessValueRangeLabel,
  chargeFeeRangeLabel,
  forcedSaleValue,
  feeRateValue,
  discountValue,
  forcedSalePercentValue,
  automaticAccessValue,
  t,
}: IndicativeValuationFinancialPanelProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-amber-50/70 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900">{t("fields.accessValue")}</div>
            <p className="text-sm text-muted-foreground">
              {automaticAccessValue
                ? t("summary.accessValueDefaultsToTotalMax")
                : t("summary.manualAccessValueLocksRange")}
            </p>
          </div>

          <Badge variant={automaticAccessValue ? "info" : "warning"} className="rounded-full px-3 py-1">
            {automaticAccessValue ? t("summary.autoRange") : t("summary.manualRange")}
          </Badge>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FormField
            control={control}
            name="accessValue"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.accessValue")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-slate-200 bg-white"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={disabled}
                    placeholder={t("fields.accessValuePlaceholder")}
                  />
                </FormControl>
                <FormDescription>{t("summary.accessValueDefaultsToTotalMax")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="feeRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.feeRate")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-slate-200 bg-white"
                    type="number"
                    step="0.0001"
                    min="0"
                    disabled={disabled}
                    placeholder={t("fields.feeRatePlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="discount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.discount")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-slate-200 bg-white"
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={disabled}
                    placeholder={t("fields.discountPlaceholder")}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="forcedSalePercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("fields.forcedSalePercent")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="h-11 border-slate-200 bg-white"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    disabled={disabled}
                    placeholder="0"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">

        <Card className={metricCardClassName}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              {t("fields.accessValueRange")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={automaticAccessValue ? "info" : "warning"} className="rounded-full">
              {automaticAccessValue ? t("summary.autoRange") : t("summary.manualRange")}
            </Badge>
            <div className="mt-3 text-lg font-semibold text-slate-950">{accessValueRangeLabel}</div>
          </CardContent>
        </Card>

        <Card className={metricCardClassName}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Receipt className="h-4 w-4 text-primary" />
              {t("fields.chargeFeeRange")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t("summary.feeChargeFormula", {
                rate: feeRateValue.toFixed(4),
                discount: discountValue.toFixed(2),
              })}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">{chargeFeeRangeLabel}</div>
          </CardContent>
        </Card>

        <Card className={metricCardClassName}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4 text-primary" />
              {t("fields.forcedSaleValue")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              {t("summary.forcedSalePercentOfTotalMax", {
                percent: forcedSalePercentValue.toFixed(2),
              })}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">
              {formatMoney(forcedSaleValue, currency)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
