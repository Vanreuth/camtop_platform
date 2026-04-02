// components/property/BasicInfoTab.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Home, FileText, AlertTriangle, Building2, RotateCcw } from 'lucide-react';
import { PropertyType } from '@/types/property.types';

interface BasicInfoTabProps {
  formData: {
    propertyName: string;
    status: string;
    workflowStatus: string;
    propertyTypeId: string;
    propertySubtypeId: string;
    currentUseId: string;
    description: string;
  };
  propertyTypes: PropertyType[];
  onInputChange: (field: string, value: string) => void;
  onReset?: () => void;
  canSelectStatus?: boolean;
  canSelectWorkflowStatus?: boolean;
  showWorkflowStatus?: boolean;
  t: (key: string) => string;
}

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  formData,
  propertyTypes,
  onInputChange,
  onReset,
  canSelectStatus = false,
  canSelectWorkflowStatus = false,
  showWorkflowStatus = true,
  t,
}) => {
  // Get selected property type details
  const selectedPropertyType = propertyTypes.find(
    (pt) => pt.propertyTypeId === parseInt(formData.propertyTypeId)
  );

  const availableSubtypes = selectedPropertyType?.subtypes || [];
  const availableCurrentUses = selectedPropertyType?.currentUses || [];
  const statusGridColsClass = canSelectStatus
    ? showWorkflowStatus
      ? "grid-cols-3"
      : "grid-cols-2"
    : showWorkflowStatus
      ? "grid-cols-2"
      : "grid-cols-1";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            {t('basicInfo')}
          </CardTitle>
          {onReset && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              <RotateCcw className="h-4 w-4" />
              {t('clearTab')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Property Type, Subtype, Current Use */}
        <div className="grid grid-cols-3 gap-12">
          <div className="space-y-2">
            <Label htmlFor="propertyTypeId" className="text-sm font-semibold flex items-center gap-2">
              {t('propertyType')}
              <span className="text-red-500 text-lg">*</span>
            </Label>
            <Select value={formData.propertyTypeId} onValueChange={(value) => onInputChange('propertyTypeId', value)}>
              <SelectTrigger id="propertyTypeId" className="h-11 border-muted-foreground/20">
                <SelectValue placeholder={t('propertyTypePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {propertyTypes.map((pt) => (
                  <SelectItem key={pt.propertyTypeId} value={pt.propertyTypeId.toString()}>
                    {pt.propertyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!formData.propertyTypeId && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Please select a property type first
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="propertySubtypeId" className="text-sm font-semibold flex items-center gap-2">
              {t('propertySubtype')}
              <span className="text-red-500 text-lg">*</span>
            </Label>
            <Select
              value={formData.propertySubtypeId}
              onValueChange={(value) => onInputChange('propertySubtypeId', value)}
              disabled={!formData.propertyTypeId}
            >
              <SelectTrigger id="propertySubtypeId" className="h-11 border-muted-foreground/20 disabled:opacity-50">
                <SelectValue placeholder={formData.propertyTypeId ? t('propertySubtypePlaceholder') : t('selectTypeFirst')} />
              </SelectTrigger>
              <SelectContent>
                {availableSubtypes.map((subtype) => (
                  <SelectItem key={subtype.propertySubtypeId} value={subtype.propertySubtypeId.toString()}>
                    {subtype.subtypeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currentUseId" className="text-sm font-semibold flex items-center gap-2">
              {t('currentUse')}
              <span className="text-red-500 text-lg">*</span>
            </Label>
            <Select
              value={formData.currentUseId}
              onValueChange={(value) => onInputChange('currentUseId', value)}
              disabled={!formData.propertyTypeId}
            >
              <SelectTrigger id="currentUseId" className="h-11 border-muted-foreground/20 disabled:opacity-50">
                <SelectValue placeholder={formData.propertyTypeId ? 'Choose usage...' : 'Select type first'} />
              </SelectTrigger>
              <SelectContent>
                {availableCurrentUses.map((use) => (
                  <SelectItem key={use.useId} value={use.useId.toString()}>
                    {use.currentUse.useName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Property Name & Status */}
        <div className={`grid ${statusGridColsClass} gap-12`}>
          <div className="space-y-2">
            <Label htmlFor="propertyName" className="text-sm font-semibold flex items-center gap-2">
              {t('propertyName')}
              <Badge variant="outline" className="text-xs font-normal bg-muted">
                {t('optional')}
              </Badge>
            </Label>
            <Input
              id="propertyName"
              placeholder={t('propertyNamePlaceholder')}
              value={formData.propertyName}
              onChange={(e) => onInputChange('propertyName', e.target.value)}
              className="mt-2 transition-all focus:ring-2 focus:ring-primary/20 border-muted-foreground/20"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground"></span>
              {t('autoInputName')}
            </p>
          </div>

          {canSelectStatus && (
            <div className="space-y-2">
              <Label htmlFor="status" className="text-sm font-semibold">
                {t('propertyStatus')} <span className="text-red-500 text-lg">*</span>
              </Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => onInputChange('status', value)}
              >
                <SelectTrigger id="status" className="h-11 border-muted-foreground/20">
                  <SelectValue placeholder={t('propertyStatusPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="INACTIVE">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                      Inactive
                    </div>
                  </SelectItem>
                  <SelectItem value="SOLD">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Sold
                    </div>
                  </SelectItem>
                  <SelectItem value="RENTED">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Rented
                    </div>
                  </SelectItem>
                  <SelectItem value="RENTAL_SALE">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                      Rental/Sale
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground"></span>
                Business status of the property (Active, Sold, Rented, etc.)
              </p>
            </div>
          )}

          {showWorkflowStatus && (
          <div className="grid grid-cols-1 gap-12">
            <div className="space-y-2">
              <Label htmlFor="workflowStatus" className="text-sm font-semibold">
                {t('workflowStatus') || 'Workflow Status'}
              </Label>
              <Select 
                value={formData.workflowStatus || 'DRAFT'} 
                onValueChange={(value) => onInputChange('workflowStatus', value)}
                disabled={!canSelectWorkflowStatus}
              >
                <SelectTrigger 
                  id="workflowStatus" 
                  className={`h-11 border-muted-foreground/20 ${!canSelectWorkflowStatus ? "bg-muted/50" : "bg-background"}`}
                >
                  <SelectValue placeholder="Select workflow status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                      Draft
                    </div>
                  </SelectItem>
                  <SelectItem value="PENDING_REVIEW">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Pending Review
                    </div>
                  </SelectItem>
                  <SelectItem value="APPROVED">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Approved
                    </div>
                  </SelectItem>
                  <SelectItem value="REJECTED">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      Rejected
                    </div>
                  </SelectItem>
                  <SelectItem value="ARCHIVED">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Archived
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              {!canSelectWorkflowStatus ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground"></span>
                  Workflow status is locked to &apos;Draft&apos; for regular users.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground"></span>
                  Use workflow actions to change approval status.
                </p>
              )}
            </div>
          </div>
        )}
        </div>

        {/* Workflow Status */}
        

        

        {/* Description */}
        <div className="border-t pt-6 mt-6">
          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-semibold flex items-center gap-2">
              {t('propertyDescription')}
              <Badge variant="outline" className="text-xs font-normal bg-muted">
                {t('optional')}
              </Badge>
            </Label>
            <Textarea
              id="description"
              placeholder={t('propertyDescriptionPlaceholder')}
              value={formData.description}
              onChange={(e) => onInputChange('description', e.target.value)}
              rows={6}
              className="min-h-[160px] resize-none transition-all focus:ring-2 focus:ring-primary/20 border-muted-foreground/20"
            />
            <div className="flex items-center justify-between text-xs">
              <p className="text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {t('propertyDescriptionInfo')}
              </p>
              <span className={formData.description.length > 0 ? 'text-primary' : 'text-muted-foreground'}>
                {formData.description.length} characters
              </span>
            </div>
          </div>
        </div>

        {/* Selected Property Type Info */}
        {selectedPropertyType && (
          <div className="mt-6 p-5 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border-2 border-primary/20 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm font-semibold text-foreground">Selected Property Classification</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default" className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 text-sm">
                    {selectedPropertyType.propertyName}
                  </Badge>
                  <Badge variant="outline" className="px-3 py-1 text-sm border-2">
                    {selectedPropertyType.recordType.recordName}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
