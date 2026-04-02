"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProperty } from "@/hooks/useProperty";
import { Loader2, MapPin, DollarSign, Calendar, Home, Ruler, ExternalLink, Building2, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Property } from "@/types/property.types";

interface PropertyDetailModalProps {
  propertyId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PropertyDetailModal({
  propertyId,
  open,
  onOpenChange,
}: PropertyDetailModalProps) {
  const { data: property, isLoading, error } = useProperty(propertyId || 0);
  type PropertyTransaction = NonNullable<Property["transaction"]>[number];

  // Property status badge styling (business status)
  const getPropertyStatusBadgeVariant = (status: string) => {
    const statusUpper = status?.toUpperCase() || "ACTIVE";
    switch (statusUpper) {
      case "ACTIVE":
        return "default";
      case "INACTIVE":
        return "secondary";
      case "SOLD":
        return "destructive";
      case "RENTED":
        return "outline";
      case "RENTAL_SALE":
        return "warning" as any;
      default:
        return "default";
    }
  };

  // Workflow status badge styling
  const getWorkflowStatusBadgeVariant = (status: string) => {
    const statusUpper = status?.toUpperCase() || "DRAFT";
    switch (statusUpper) {
      case "DRAFT":
        return "secondary";
      case "PENDING_REVIEW":
        return "warning" as any;
      case "APPROVED":
        return "success" as any;
      case "REJECTED":
        return "destructive";
      case "ARCHIVED":
        return "outline";
      default:
        return "secondary";
    }
  };

  // Format address hierarchy
  const formattedAddress = useMemo(() => {
    if (!property?.propertyAddress) return "Unknown Location";

    const { houseNo, street, province, district, commune } = property.propertyAddress;
    const parts = [];

    if (houseNo) parts.push(`#${houseNo}`);
    if (street) parts.push(street);
    if (commune?.nameKh || commune?.nameEn) parts.push(commune.nameKh || commune.nameEn);
    if (district?.nameKh || district?.nameEn) parts.push(district.nameKh || district.nameEn);
    if (province?.nameKh || province?.nameEn) parts.push(province.nameKh || province.nameEn);

    return parts.length > 0 ? parts.join(", ") : "Unknown Location";
  }, [property]);

  // Latest transaction
  const transactions = useMemo(() => property?.transaction ?? [], [property]);

  const latestTransaction = useMemo(() => {
    if (transactions.length === 0) return null;
    return transactions[0];
  }, [transactions]);

  const latitude =
    property?.propertyLocation?.point?.latitude ??
    property?.propertyLocation?.latitude;
  const longitude =
    property?.propertyLocation?.point?.longitude ??
    property?.propertyLocation?.longitude;
  const googleMapLink =
    (property as unknown as { googleMapLink?: string } | undefined)?.googleMapLink ??
    null;
  const createdByUser =
    property?.createdByUser ??
    (property as unknown as {
      User?: { firstName?: string; lastName?: string; email?: string };
    } | undefined)?.User ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-96 gap-4 px-6">
            <div className="text-destructive font-semibold text-lg">
              Failed to load property details
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {(error as any)?.message || "An unexpected error occurred"}
            </p>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Close
            </Button>
          </div>
        )}

        {property && !isLoading && !error && (
          <>
            {/* Header Section */}
            <DialogHeader className="px-6 py-5 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <DialogTitle className="text-xl font-bold">
                      {property.propertyName}
                    </DialogTitle>
                    <Badge variant={getPropertyStatusBadgeVariant(property.status)}>
                      {property.status || "ACTIVE"}
                    </Badge>
                    {property.workflowStatus && (
                      <Badge variant={getWorkflowStatusBadgeVariant(property.workflowStatus)}>
                        {property.workflowStatus}
                      </Badge>
                    )}
                  </div>

                  <DialogDescription className="flex items-center gap-2 text-sm">
                    <span className="font-mono font-semibold text-foreground">
                      #{property.propertyCode}
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="line-clamp-1">{formattedAddress}</span>
                  </DialogDescription>
                </div>

                {googleMapLink && (
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="shrink-0"
                  >
                    <a
                      href={googleMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      Open in Maps
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                )}
              </div>
            </DialogHeader>

            {/* Tabbed Content */}
            <ScrollArea className="h-[calc(90vh-140px)]">
              <Tabs defaultValue="overview" className="w-full">
                <div className="sticky top-0 z-10 bg-background border-b px-6 pt-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="overview" className="gap-2">
                      <Home className="h-4 w-4" />
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="gap-2">
                      <DollarSign className="h-4 w-4" />
                      Transactions
                      {transactions.length > 0 && (
                        <Badge variant="secondary" className="ml-1 text-xs">
                          {transactions.length}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="details" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Details
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Overview Tab */}
                <TabsContent value="overview" className="px-6 py-4 space-y-4">
                  {/* Latest Transaction Highlight */}
                  {latestTransaction && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Latest Transaction
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <div className="text-3xl font-bold">
                              {formatCurrency(latestTransaction.totalPrice)}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {latestTransaction.transactionType}
                            </div>
                          </div>
                          <Badge variant="outline" className="gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(latestTransaction.transactionDate)}
                          </Badge>
                        </div>

                        {latestTransaction.pricePerSqm && (
                          <Separator />
                        )}

                        {latestTransaction.pricePerSqm && (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Price per m²</div>
                              <div className="font-semibold">
                                {formatCurrency(latestTransaction.pricePerSqm)}/m²
                              </div>
                            </div>
                            {latestTransaction.residualLandValue && (
                              <div>
                                <div className="text-muted-foreground">Land Value</div>
                                <div className="font-semibold">
                                  {formatCurrency(latestTransaction.residualLandValue)}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Property Information Grid */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Property Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground mb-1">Property Type</dt>
                          <dd className="font-semibold">
                            {property.propertyType?.propertyName || "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground mb-1">Property Subtype</dt>
                          <dd className="font-semibold">
                            {property.propertySubtype?.subtypeName || "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground mb-1">Total Area</dt>
                          <dd className="font-semibold flex items-center gap-1">
                            <Ruler className="h-3.5 w-3.5" />
                            {property.floorAreaSqm
                              ? `${property.floorAreaSqm.toLocaleString()} m²`
                              : "N/A"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground mb-1">Land Area</dt>
                          <dd className="font-semibold flex items-center gap-1">
                            <Ruler className="h-3.5 w-3.5" />
                            {property.landAreaSqm
                              ? `${property.landAreaSqm.toLocaleString()} m²`
                              : "N/A"}
                          </dd>
                        </div>
                        {property.buildingAreaSqm && (
                          <div>
                            <dt className="text-muted-foreground mb-1">Building Area</dt>
                            <dd className="font-semibold flex items-center gap-1">
                              <Ruler className="h-3.5 w-3.5" />
                              {property.buildingAreaSqm.toLocaleString()} m²
                            </dd>
                          </div>
                        )}
                      </dl>
                    </CardContent>
                  </Card>

                  {/* Location Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <div className="text-muted-foreground mb-1">Full Address</div>
                        <div className="font-medium">{formattedAddress}</div>
                      </div>

                      {latitude && longitude && (
                        <>
                          <Separator />
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-muted-foreground mb-1">Latitude</div>
                              <div className="font-mono text-xs">{latitude}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground mb-1">Longitude</div>
                              <div className="font-mono text-xs">{longitude}</div>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Transactions Tab */}
                <TabsContent value="transactions" className="px-6 py-4">
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <DollarSign className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No transactions found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction: PropertyTransaction, index: number) => (
                        <Card key={transaction.transactionId || index}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-4">
                              <div>
                                <div className="text-2xl font-bold">
                                  {formatCurrency(transaction.totalPrice)}
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  {transaction.transactionType}
                                </div>
                              </div>
                              <Badge variant="outline" className="gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(transaction.transactionDate)}
                              </Badge>
                            </div>

                            <Separator className="my-3" />

                            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                              {transaction.pricePerSqm && (
                                <div>
                                  <dt className="text-muted-foreground">Price per m²</dt>
                                  <dd className="font-semibold">
                                    {formatCurrency(transaction.pricePerSqm)}/m²
                                  </dd>
                                </div>
                              )}
                              {transaction.residualLandValue && (
                                <div>
                                  <dt className="text-muted-foreground">Land Value</dt>
                                  <dd className="font-semibold">
                                    {formatCurrency(transaction.residualLandValue)}
                                  </dd>
                                </div>
                              )}
                              {transaction.newBuildingCost && (
                                <div>
                                  <dt className="text-muted-foreground">New Building Cost</dt>
                                  <dd className="font-semibold">
                                    {formatCurrency(transaction.newBuildingCost)}
                                  </dd>
                                </div>
                              )}
                              {transaction.currentBuildingValue && (
                                <div>
                                  <dt className="text-muted-foreground">Current Building Value</dt>
                                  <dd className="font-semibold">
                                    {formatCurrency(transaction.currentBuildingValue)}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Details Tab */}
                <TabsContent value="details" className="px-6 py-4 space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">System Information</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <dt className="text-muted-foreground mb-1">Property ID</dt>
                          <dd className="font-mono text-xs">{property.propertyId}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground mb-1">Status</dt>
                          <dd>
                            <Badge variant={getPropertyStatusBadgeVariant(property.status)}>
                              {property.status}
                            </Badge>
                          </dd>
                        </div>
                        {property.workflowStatus && (
                          <div>
                            <dt className="text-muted-foreground mb-1">Workflow Status</dt>
                            <dd>
                              <Badge variant={getWorkflowStatusBadgeVariant(property.workflowStatus)}>
                                {property.workflowStatus}
                              </Badge>
                            </dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-muted-foreground mb-1">Created At</dt>
                          <dd className="font-medium">{formatDate(property.createdAt)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground mb-1">Updated At</dt>
                          <dd className="font-medium">{formatDate(property.updatedAt)}</dd>
                        </div>
                      </dl>
                    </CardContent>
                  </Card>

                  {createdByUser && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Created By</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        <div className="space-y-2">
                          <div>
                            <span className="text-muted-foreground">Name: </span>
                            <span className="font-semibold">
                              {createdByUser.firstName} {createdByUser.lastName}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Email: </span>
                            <span className="font-medium">{createdByUser.email}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            </ScrollArea>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t bg-muted/50 flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Last updated: {formatDate(property.updatedAt)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    window.open(`/dashboard/property/${property.propertyId}`, '_blank');
                  }}
                >
                  View Full Details
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
