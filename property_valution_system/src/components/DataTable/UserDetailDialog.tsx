"use client";

import { User } from "@/types/user.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  Calendar,
  Shield,
  Activity,
  Clock,
  User as UserIcon,
  Edit,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface UserDetailDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (user: User) => void;
  onDelete?: (user: User) => void;
}

const getRoleBadgeVariant = (roleName: string) => {
  const variants: Record<string, any> = {
    "Super Administrator": "destructive",
    "Property Manager": "default",
    "Data Entry": "secondary",
    Viewer: "outline",
  };
  return variants[roleName] || "outline";
};

export function UserDetailDialog({
  user,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: UserDetailDialogProps) {
  if (!user) return null;

  const fullName =
    `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username;
  const initials =
    `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() ||
    user.username?.[0]?.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>
            View comprehensive information about this user
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Header */}
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20">
              {user.profilePicture ? (
                <AvatarImage src={user.profilePicture} alt={fullName} />
              ) : (
                <AvatarFallback className="text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-2xl font-bold">{fullName}</h3>
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
                <Badge
                  variant={user.status === "ACTIVE" ? "default" : "destructive"}
                >
                  <Activity className="mr-1 h-3 w-3" />
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Email</p>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </p>
                </div>
                {user.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      {user.phone}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Roles & Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Roles & Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {user.roles && user.roles.length > 0 ? (
                <div className="space-y-3">
                  {user.roles.map((userRole: any) => (
                    <div
                      key={userRole.roleId}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            {userRole.role?.roleName || "Unknown Role"}
                          </p>
                          {userRole.role?.description && (
                            <p className="text-xs text-muted-foreground">
                              {userRole.role.description}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={getRoleBadgeVariant(userRole.role?.roleName)}
                      >
                        {userRole.role?.roleName}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No roles assigned
                </p>
              )}
            </CardContent>
          </Card>

          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserIcon className="h-4 w-4" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last Updated
                  </p>
                  <p className="text-sm font-medium">
                    {new Date(user.updatedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">User ID</p>
                  <p className="font-mono text-xs">{user.id}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge
                    variant={
                      user.status === "ACTIVE" ? "default" : "destructive"
                    }
                  >
                    {user.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => {
                  onEdit(user);
                  onOpenChange(false);
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit User
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  onDelete(user);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete User
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
