"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Camera,
  User as UserIcon,
  Mail,
  Lock,
  Phone,
  Shield,
  Activity,
} from "lucide-react";
import type { User } from "@/types/user.types";
import { useRoles } from "@/hooks/role/useRole";
import { cn } from "@/lib/utils";

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialData?: User | null;
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

type FormState = {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  bio: string;
  roleId: string;
  status: string;
  profilePicture: string | File | null;
};

const createDefaultState = (roleId: string): FormState => ({
  username: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  phone: "",
  bio: "",
  roleId,
  status: "ACTIVE",
  profilePicture: null,
});

export function UserEditDialog({
  open,
  onOpenChange,
  title,
  description,
  initialData,
  onSubmit,
  isLoading = false,
}: UserEditDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [changePassword, setChangePassword] = useState(false);

  const { data: rolesData, isLoading: rolesLoading, isError: rolesError } =
    useRoles({ page: 1, limit: 100 });

  const activeRoles = useMemo(() => {
    return (rolesData?.roles ?? []).filter((role) => role.isActive !== false);
  }, [rolesData?.roles]);

  const defaultRoleId = useMemo(() => {
    const preferred =
      activeRoles.find((role) => role.roleCode === "VIEWER") ??
      activeRoles.find(
        (role) => role.roleName?.toLowerCase() === "viewer"
      );
    const fallback = preferred ?? activeRoles[0];
    return fallback ? String(fallback.id) : "";
  }, [activeRoles]);

  const [formData, setFormData] = useState<FormState>(
    createDefaultState("")
  );
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!open) return;

    setChangePassword(false);

    if (initialData) {
      setFormData({
        username: initialData.username || "",
        email: initialData.email || "",
        password: "",
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        phone: initialData.phone || "",
        bio: (initialData as any).bio || "",
        roleId: initialData.roles?.[0]?.roleId?.toString() || "",
        status: initialData.status || "",
        profilePicture: initialData.profilePicture || null,
      });
      setImagePreview(initialData.profilePicture || null);
    } else {
      setFormData(createDefaultState(""));
      setImagePreview(null);
    }
  }, [initialData, open]);

  useEffect(() => {
    if (!open || !defaultRoleId) return;
    setFormData((prev) =>
      prev.roleId ? prev : { ...prev, roleId: defaultRoleId }
    );
  }, [open, defaultRoleId]);

  const initials = useMemo(() => {
    const f = formData.firstName?.[0]?.toUpperCase() || "";
    const l = formData.lastName?.[0]?.toUpperCase() || "";
    return (f + l) || "?";
  }, [formData.firstName, formData.lastName]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImagePreview((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return prev;
    });

    setFormData((prev) => ({ ...prev, profilePicture: file }));
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const payload: any = { ...formData };
    if (!changePassword || !payload.password?.trim()) {
      delete payload.password;
    }

    onSubmit(payload);
  };

  const roleSelectDisabled = isLoading || rolesLoading;
  const passwordEnabled = changePassword;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserIcon className="w-5 h-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
        </div>

        <Separator />

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center gap-5">
            <div
              className={cn(
                "relative group cursor-pointer shrink-0",
                isLoading && "pointer-events-none opacity-70"
              )}
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload image"
            >
              <Avatar className="h-24 w-24 border-4 border-muted shadow-sm transition-transform group-hover:scale-[1.02]">
                <AvatarImage src={imagePreview || ""} className="object-cover" />
                <AvatarFallback className="text-lg font-bold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full text-white">
                <Camera className="w-7 h-7" />
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  Change Photo
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                JPG/PNG recommended. Large images may take longer to upload.
              </p>
            </div>
          </div>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Account Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">
                  Username <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <UserIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    className="pl-9"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                    disabled={isLoading}
                    placeholder="e.g. vanreuthml"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={isLoading}
                    placeholder="e.g. user@example.com"
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="space-y-2 col-span-1 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password">Password</Label>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Change password
                    </span>
                    <Switch
                      checked={changePassword}
                      onCheckedChange={setChangePassword}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-9"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    disabled={isLoading || !passwordEnabled}
                    placeholder={
                      changePassword
                        ? "Enter a new password"
                        : "Password unchanged"
                    }
                    autoComplete="new-password"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Leave it off to keep the current password.
                </p>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-primary" /> Personal Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                  disabled={isLoading}
                  placeholder="Enter first name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                  disabled={isLoading}
                  placeholder="Enter last name"
                />
              </div>

              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="phone">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-9"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    disabled={isLoading}
                    placeholder="e.g. +855 12 345 678"
                  />
                </div>
              </div>

              <div className="space-y-2 col-span-1 md:col-span-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  disabled={isLoading}
                  placeholder="Short bio about the user"
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Role & Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleId">
                  Role <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.roleId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, roleId: value })
                  }
                  disabled={roleSelectDisabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {rolesLoading && (
                      <SelectItem value="__loading" disabled>
                        Loading roles...
                      </SelectItem>
                    )}
                    {!rolesLoading && rolesError && (
                      <SelectItem value="__error" disabled>
                        Failed to load roles
                      </SelectItem>
                    )}
                    {!rolesLoading && !rolesError && activeRoles.length === 0 && (
                      <SelectItem value="__empty" disabled>
                        No roles available
                      </SelectItem>
                    )}
                    {!rolesLoading &&
                      !rolesError &&
                      activeRoles.map((role) => (
                        <SelectItem key={role.id} value={String(role.id)}>
                          {role.roleName || role.roleCode}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">
                  Account Status <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                  disabled={isLoading}
                >
                  <SelectTrigger
                    className={cn(
                      formData.status === "ACTIVE"
                        ? "text-green-600 font-medium"
                        : "text-red-600 font-medium"
                    )}
                  >
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                 <SelectContent>
                    <SelectItem value="ACTIVE" className="text-green-600">
                      Active
                    </SelectItem>
                    <SelectItem value="PENDING" className="text-yellow-600">
                      Pending
                    </SelectItem>
                    <SelectItem value="SUSPENDED" className="text-orange-600">
                      Suspended
                    </SelectItem>
                    <SelectItem value="DISABLED" className="text-gray-600">
                      Disabled
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isLoading} className="min-w-[140px]">
              {isLoading ? "Saving..." : "Update User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
