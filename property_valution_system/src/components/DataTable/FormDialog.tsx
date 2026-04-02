"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Loader2 } from "lucide-react";
import { FormField } from "./types";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  fields: FormField[];
  initialData?: any;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialData,
  onSubmit,
  isLoading,
}: FormDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (open) {
      const initial: Record<string, any> = {};
      fields.forEach((field) => {
        let value = initialData?.[field.name] ?? field.defaultValue ?? "";
        
        // Convert to string for select fields to ensure proper matching
        if (field.type === "select" && value !== "") {
          value = String(value);
        }
        
        initial[field.name] = value;
      });
      setFormData(initial);
      setErrors({});

      // Set preview image if editing user with profile picture
      if (initialData?.profilePicture) {
        setPreviewImage(initialData.profilePicture);
      } else {
        setPreviewImage(null);
      }
      setSelectedFile(null);
    }
  }, [open, fields, initialData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: "Please select an image file",
        }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          profilePicture: "File size must be less than 5MB",
        }));
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Clear error if any
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.profilePicture;
        return newErrors;
      });
    }
  };

  const clearImage = () => {
    setPreviewImage(null);
    setSelectedFile(null);
    setFormData((prev) => {
      const newData = { ...prev };
      delete newData.profilePicture;
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formData[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.validation) {
        const error = field.validation(formData[field.name]);
        if (error) newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Create FormData if there's a file
    if (selectedFile) {
      const submitData = new FormData();

      // Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          submitData.append(key, value);
        }
      });

      // Append the file
      submitData.append("profilePicture", selectedFile);

      onSubmit(submitData);
    } else {
      onSubmit(formData);
    }
  };

  const updateField = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const renderField = (field: FormField) => {
    const Icon = field.icon;

    switch (field.type) {
      case "select":
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Select
              value={formData[field.name] || field.defaultValue || ""}
              onValueChange={(v) => updateField(field.name, v)}
            >
              <SelectTrigger id={field.name}>
                <SelectValue placeholder={field.placeholder || `Select ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors[field.name] && (
              <p className="text-sm text-destructive">{errors[field.name]}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={formData[field.name]}
              onChange={(e) => updateField(field.name, e.target.value)}
              className="min-h-[100px]"
            />
            {errors[field.name] && (
              <p className="text-sm text-destructive">{errors[field.name]}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={field.name} className="grid gap-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <div className="relative">
              {Icon && (
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              )}
              <Input
                id={field.name}
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.name]}
                onChange={(e) => updateField(field.name, e.target.value)}
                className={Icon ? "pl-10" : ""}
              />
            </div>
            {errors[field.name] && (
              <p className="text-sm text-destructive">{errors[field.name]}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="lg:max-w-3xl sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center ">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Form Fields */}
          {fields.map((field) => renderField(field))}

          {/* Profile Picture Upload */}
          <div className="grid gap-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                {previewImage ? (
                  <AvatarImage src={previewImage} />
                ) : (
                  <AvatarFallback>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      document.getElementById("file-upload")?.click()
                    }
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                  {previewImage && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG or GIF. Max 5MB
                </p>
              </div>
            </div>
            {errors.profilePicture && (
              <p className="text-sm text-destructive">
                {errors.profilePicture}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Saving..." : initialData ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
