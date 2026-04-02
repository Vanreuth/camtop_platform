"use client";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader, // We won't use this wrapper directly to keep custom layout
  DialogTitle, // <--- Importing this is crucial
  DialogDescription, // <--- Importing this is crucial
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@/types/user.types";
import {
  Mail,
  Phone,
  Calendar,
  Edit,
  Trash2,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Camera,
  Copy,
  Fingerprint,
  Briefcase,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
  onProfileImageUpdate?: (userId: number, file: File) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  isDeleting?: boolean;
}

export function UserDetailModal({
  open,
  onOpenChange,
  user,
  onEdit,
  onDelete,
  onProfileImageUpdate,
  canEdit = true,
  canDelete = true,
  isDeleting = false,
}: UserDetailModalProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        document.body.style.pointerEvents = "";
        document.body.style.overflow = "";
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (!user) return null;

  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Use JPG, PNG, or WEBP.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setPreviewImage(reader.result as string);
    reader.readAsDataURL(file);

    if (onProfileImageUpdate) {
      setIsUploadingImage(true);
      try {
        await onProfileImageUpdate(user.id, file);
        toast.success("Profile image updated successfully");
      } catch (error) {
        toast.error("Failed to update image");
        setPreviewImage(null);
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[650px] p-0 gap-0 overflow-hidden">
          {/* --- HEADER SECTION (Fixed Accessibility Error) --- */}
          <div className="bg-muted/30 border-b p-6 flex flex-col items-center sm:flex-row sm:items-start gap-6">
            {/* Avatar Section */}
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-md">
                <AvatarImage
                  src={previewImage || user.profilePicture || ""}
                  className="object-cover"
                />
                <AvatarFallback className="text-3xl font-bold text-primary bg-primary/10">
                  {user.firstName?.[0]}
                  {user.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="profile-upload"
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[2px]"
              >
                {isUploadingImage ? (
                  <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </label>
              <Input
                id="profile-upload"
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={isUploadingImage}
              />
            </div>

            {/* Title Section */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                {/* 👇 FIX 1: Use DialogTitle instead of h2 */}
                <DialogTitle className="text-2xl font-bold text-foreground">
                  {fullName}
                </DialogTitle>

                {/* 👇 FIX 2: Use DialogDescription instead of p */}
                <DialogDescription className="text-muted-foreground text-sm font-medium">
                  @{user.username}
                </DialogDescription>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "pl-1.5",
                    user.status === "ACTIVE"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {user.status === "ACTIVE" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 mr-1" />
                  )}
                  {user.status}
                </Badge>

                {user.roles?.map((r: any) => (
                  <Badge
                    key={r.roleId}
                    variant="secondary"
                    className="bg-background border"
                  >
                    {r.role?.roleName || "Unknown Role"}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* --- TABS CONTENT SECTION --- */}
          <div className="p-6">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="roles">Roles & Access</TabsTrigger>
                <TabsTrigger value="system">System Data</TabsTrigger>
              </TabsList>

              <TabsContent
                value="overview"
                className="space-y-6 animate-in fade-in-50"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoCard
                    icon={<Mail className="w-4 h-4 text-blue-500" />}
                    label="Email Address"
                    value={user.email}
                    onCopy={() => copyToClipboard(user.email, "Email")}
                  />
                  <InfoCard
                    icon={<Phone className="w-4 h-4 text-green-500" />}
                    label="Phone Number"
                    value={user.phone || "Not Provided"}
                    onCopy={
                      user.phone
                        ? () => copyToClipboard(user.phone || "", "Phone")
                        : undefined
                    }
                  />
                  <InfoCard
                    icon={<Fingerprint className="w-4 h-4 text-purple-500" />}
                    label="User ID"
                    value={String(user.id)}
                    onCopy={() => copyToClipboard(String(user.id), "User ID")}
                  />
                  <InfoCard
                    icon={<Briefcase className="w-4 h-4 text-amber-500" />}
                    label="Primary Role"
                    value={user.roles?.[0]?.role?.roleName || "No Role"}
                  />
                </div>
              </TabsContent>

              <TabsContent
                value="roles"
                className="space-y-4 animate-in fade-in-50"
              >
                <ScrollArea className="h-[240px] rounded-md border p-4 bg-muted/10">
                  {user.roles && user.roles.length > 0 ? (
                    <div className="space-y-3">
                      {user.roles.map((r: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-background rounded-lg border shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-full">
                              <Shield className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {r.role?.roleName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Level {r.role?.hierarchyLevel}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline">Assigned</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Shield className="w-10 h-10 mb-2 opacity-20" />
                      <p>No roles assigned</p>
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent
                value="system"
                className="space-y-6 animate-in fade-in-50"
              >
                <div className="grid gap-4">
                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/10">
                    <div className="p-2 bg-background rounded-full border shadow-sm">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Account Created</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString(
                          undefined,
                          { dateStyle: "full" }
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/10">
                    <div className="p-2 bg-background rounded-full border shadow-sm">
                      <Calendar className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.updatedAt).toLocaleDateString(
                          undefined,
                          { dateStyle: "full" }
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* --- FOOTER ACTIONS --- */}
          <div className="p-6 bg-muted/30 border-t flex justify-end gap-3">
            {canDelete && onDelete && user.status === "ACTIVE" && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete User
              </Button>
            )}

            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>

            {canEdit && onEdit && (
              <Button
                onClick={() => {
                  onEdit(user);
                  onOpenChange(false);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Details
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {user.username}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (onDelete) {
                  onDelete(user);
                  setShowDeleteDialog(false);
                  onOpenChange(false);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function InfoCard({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <div className="p-3 border rounded-lg bg-background flex items-center justify-between group hover:border-primary/50 transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 rounded-md bg-muted/50 group-hover:bg-muted transition-colors">
          {icon}
        </div>
        <div className="overflow-hidden">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-sm font-semibold truncate" title={value}>
            {value}
          </p>
        </div>
      </div>
      {onCopy && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onCopy}
        >
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}
