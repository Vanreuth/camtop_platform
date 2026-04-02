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
import { Users, RotateCcw, FileText } from "lucide-react";
import { PropertyFormData } from "@/types/property.types";

interface DataSourceProps {
  formData: PropertyFormData;
  onInputChange: (field: string, value: any) => void;
  onReset: () => void;
  t: (key: string) => string;
  tc: (key: string) => string;
}

export function DataSourceTab({
  formData,
  onInputChange,
  onReset,
  t,
  tc,
}: DataSourceProps) {
  return (
     <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Data Source Information
                  </CardTitle>
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
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sourceType">
                      {t("sourceType")} <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.sourceType}
                      onValueChange={(value) =>
                        onInputChange("sourceType", value)
                      }
                    >
                      <SelectTrigger id="sourceType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNERSHIP">Ownership</SelectItem>
                        <SelectItem value="AGENCY">Agent</SelectItem>
                        <SelectItem value="AUTHORITY">Authority</SelectItem>
                        <SelectItem value="BANK">Bank</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">{t("contactName")}</Label>
                    <Input
                      id="contactName"
                      placeholder={t("fullNamePlaceholder")}
                      value={formData.contactName}
                      onChange={(e) =>
                        onInputChange("contactName", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">
                      {t("phoneNumber")} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="phoneNumber"
                      placeholder={t("enterPhoneNumber")}
                      value={formData.phoneNumber}
                      onChange={(e) =>
                        onInputChange("phoneNumber", e.target.value)
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
  );
}
