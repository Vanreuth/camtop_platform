"use client";
import { useState } from "react";
import { useRouter } from "@/lib/navigation";
import { useTranslations } from "next-intl";
import { useUser, useDeleteUser, useReactivateUser } from "@/hooks/user/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Shield,
  Activity,
  Edit,
  Trash2,
  RefreshCw,
  Key,
  Clock,
  User as UserIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
// Removed Can import as we are handling permissions in onClick
import { useAuth } from "@/hooks/auth/useAuth";
import { toast } from "sonner";
import { User } from "@/types";

interface UserDetailPageProps {
  params: {
    id: string;
  };
}

// Helper function to get role badge variant
const getRoleBadgeVariant = (roleName: string) => {
  const variants: Record<string, any> = {
    "Super Administrator": "destructive",
    "Property Manager": "default",
    "Data Entry": "secondary",
    Viewer: "outline",
  };
  return variants[roleName] || "outline";
};

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = Number(params.id);
  const {hasPermission, hasHierarchyLevel, isSuperAdmin } = useAuth();
  const t = useTranslations("users");

  if (!Number.isFinite(userId)) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive">{t("failedToLoadUser")}</p>
            <Button onClick={() => router.back()} className="mt-4">
              {t("goBack")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);

  // Fetch user data
  const { data: user, isLoading, error } = useUser(userId);

  // Mutations
  const deleteMutation = useDeleteUser();
  const reactivateMutation = useReactivateUser();

  const handleDelete = () => {
    deleteMutation.mutate(userId, {
      onSuccess: () => {
        setShowDeleteDialog(false);
        queryClient.invalidateQueries({ queryKey: ["user", userId] });
        queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      onError: (error: any) => {
        console.error("Delete error:", error);
      },
    });
  };

  const handleReactivate = () => {
    reactivateMutation.mutate(userId, {
      onSuccess: () => {
        setShowReactivateDialog(false);
        queryClient.invalidateQueries({ queryKey: ["user", userId] });
        queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      onError: (error: any) => {
        console.error("Reactivate error:", error);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">
              {t("loadingUserDetails")}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive">{t("failedToLoadUser")}</p>
            <Button onClick={() => router.back()} className="mt-4">
              {t("goBack")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isTargetSuperAdmin = (targetUser: User): boolean => {
    return (
      targetUser.roles?.some(
        (r: any) =>
          r.role?.roleCode === "SUPER_ADMIN" ||
          r.role?.roleName === "Super Administrator"
      ) ?? false
    );
  };

  const targetIsSuperAdmin = isTargetSuperAdmin(user);

  return (
    <PermissionGuard hierarchyLevel={2} redirectTo="/dashboard">
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{t("userDetails")}</h1>
              <p className="text-muted-foreground">
                {t("viewAndManageUser")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Reactivate Button - REMOVED <CAN> WRAPPER */}
            {user.status !== "ACTIVE" && (
              <Button
                variant="outline"
                disabled={reactivateMutation.isPending || targetIsSuperAdmin}
                onClick={() => {
                  // Permission Check inside onClick
                  if (
                    !isSuperAdmin() &&
                    (!hasHierarchyLevel(1) || !hasPermission("user:update"))
                  ) {
                    toast.error(t("accessDenied"), {
                      description: t("noPermissionReactivate"),
                    });
                    return;
                  }
                  setShowReactivateDialog(true);
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("reactivate")}
              </Button>
            )}

            {/* Edit Button - REMOVED <CAN> WRAPPER */}
            <Button
              variant="outline"
              disabled={targetIsSuperAdmin}
              onClick={() => {
                // Permission Check inside onClick
                if (
                  !isSuperAdmin() &&
                  (!hasHierarchyLevel(1) || !hasPermission("user:update"))
                ) {
                  toast.error(t("accessDenied"), {
                    description: t("noPermissionEdit"),
                  });
                  return;
                }
                router.push(`/dashboard/users/${userId}/edit`);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              {t("edit")}
            </Button>

            {/* Deactivate Button - REMOVED <CAN> WRAPPER */}
            {user.status === "ACTIVE" && (
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending || targetIsSuperAdmin}
                onClick={() => {
                  // Permission Check inside onClick
                  if (
                    !isSuperAdmin() &&
                    (!hasHierarchyLevel(1) || !hasPermission("user:update"))
                  ) {
                    toast.error(t("accessDenied"), {
                      description: t("noPermissionDeactivate"),
                    });
                    return;
                  }
                  setShowDeleteDialog(true);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deactivate")}
              </Button>
            )}
          </div>
        </div>

        {/* ... Rest of the Profile Overview, Tabs, etc. (No changes needed below) ... */}

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-24 w-24">
                {user.profilePicture ? (
                  <AvatarImage src={user.profilePicture} alt={user.username} />
                ) : (
                  <AvatarFallback className="text-2xl font-semibold">
                    {user.firstName?.[0]}
                    {user.lastName?.[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="flex-1 space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {user.firstName} {user.lastName}
                  </h2>
                  <p className="text-muted-foreground">@{user.username}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {user.roles?.map(
                    (r: { roleId: number; role: { roleName: string } }) => (
                      <Badge
                        key={r.roleId}
                        variant={getRoleBadgeVariant(r.role.roleName)}
                      >
                        <Shield className="mr-1 h-3 w-3" />
                        {r.role.roleName}
                      </Badge>
                    )
                  )}
                  <Badge
                    variant={
                      user.status === "ACTIVE" ? "default" : "destructive"
                    }
                  >
                    <Activity className="mr-1 h-3 w-3" />
                    {user.status}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Information Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
            <TabsTrigger value="roles">{t("rolesAndPermissions")}</TabsTrigger>
            <TabsTrigger value="activity">{t("activity")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    {t("contactInformation")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("email")}
                    </label>
                    <p className="text-sm mt-1">{user.email}</p>
                  </div>
                  {user.phone && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        {t("phone")}
                      </label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        {user.phone}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    {t("accountInformation")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("username")}
                    </label>
                    <p className="text-sm mt-1">@{user.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("userId")}
                    </label>
                    <p className="text-sm mt-1">#{user.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("status")}
                    </label>
                    <div className="mt-1">
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

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Created At
                      </label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {new Date(user.createdAt).toLocaleString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Last Updated
                      </label>
                      <p className="text-sm mt-1 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {new Date(user.updatedAt).toLocaleString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Assigned Roles
                  </CardTitle>
                  <CardDescription>
                    Roles that define user access level
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user.roles && user.roles.length > 0 ? (
                    <div className="space-y-3">
                      {user.roles.map(
                        (userRole: {
                          roleId: number;
                          role: {
                            roleName: string;
                            roleCode?: string;
                            description?: string;
                            hierarchyLevel?: number;
                          };
                          assignedAt: string;
                          assignedBy: number;
                          isActive: boolean;
                        }) => (
                          <div
                            key={userRole.roleId}
                            className="border rounded-lg p-4 bg-gradient-to-br from-muted/30 to-muted/10 hover:from-muted/40 hover:to-muted/20 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <h3 className="font-semibold text-base flex items-center gap-2">
                                  {userRole.role.roleName}
                                  {userRole.isActive && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      Active
                                    </Badge>
                                  )}
                                </h3>
                                {userRole.role.roleCode && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Code: {userRole.role.roleCode}
                                  </p>
                                )}
                                {userRole.role.hierarchyLevel !== undefined && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Level: {userRole.role.hierarchyLevel}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant={getRoleBadgeVariant(
                                  userRole.role.roleName
                                )}
                                className="ml-2"
                              >
                                #{userRole.roleId}
                              </Badge>
                            </div>
                            <Separator className="my-3" />
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  Assigned:
                                </span>
                                <span className="font-medium">
                                  {new Date(
                                    userRole.assignedAt
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <UserIcon className="h-3 w-3" />
                                  By User:
                                </span>
                                <span className="font-medium">
                                  #{userRole.assignedBy}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No roles assigned
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Permissions
                  </CardTitle>
                  <CardDescription>
                    Combined permissions from all roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {user.roles && user.roles.length > 0 ? (
                    <div className="space-y-4">
                      {user.roles.map(
                        (userRole: {
                          roleId: number;
                          role: {
                            roleName: string;
                            permissions?: Array<{
                              permission: {
                                id: number;
                                permissionName: string;
                                permissionCode?: string;
                              };
                            }>;
                          };
                        }) => (
                          <div key={userRole.roleId} className="space-y-2">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              {userRole.role.roleName}
                            </h4>
                            {userRole.role.permissions &&
                            userRole.role.permissions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {userRole.role.permissions.map((rp) => (
                                  <Badge
                                    key={rp.permission.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {rp.permission.permissionCode ||
                                      rp.permission.permissionName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">
                                No specific permissions
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Key className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No permissions assigned
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>
                  Recent activities and changes for this user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 pb-4 border-b">
                    <div className="rounded-full bg-primary/10 p-2">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Account Created</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(user.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 pb-4 border-b">
                    <div className="rounded-full bg-blue-500/10 p-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Last Updated</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(user.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {user.roles?.map((role: any) => (
                    <div
                      key={role.roleId}
                      className="flex items-start gap-4 pb-4 border-b"
                    >
                      <div className="rounded-full bg-green-500/10 p-2">
                        <Shield className="h-4 w-4 text-green-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Role Assigned: {role.role.roleName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(role.assignedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                {t("deactivate")} {t("userColumn")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmDeactivate")}{" "}
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                ? {t("confirmDeactivateDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? t("deactivating") : t("deactivate")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reactivate Dialog */}
        <AlertDialog
          open={showReactivateDialog}
          onOpenChange={setShowReactivateDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                {t("reactivate")} {t("userColumn")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("confirmReactivate")}{" "}
                <strong>
                  {user.firstName} {user.lastName}
                </strong>
                ? {t("confirmReactivateDesc")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleReactivate}
                disabled={reactivateMutation.isPending}
              >
                {reactivateMutation.isPending
                  ? t("reactivating")
                  : t("reactivate")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PermissionGuard>
  );
}
