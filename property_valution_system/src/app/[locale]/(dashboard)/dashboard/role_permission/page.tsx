"use client";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  Users,
  Key,
  Crown,
  Star,
  FileKey,
  CheckCircle,
  XCircle,
  UserPlus,
  ShieldPlus,
  Link2,
  Unlink,
  Activity,
  TrendingUp,
  Search,
  Edit,
  Trash2,
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  X,
  Eye,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import {
  useRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useAssignRole,
  useRevokeRole,
} from "@/hooks/role/useRole";
import {
  usePermissions,
  useCreatePermission,
  useUpdatePermission,
  useDeactivatePermission,
  useAssignPermission,
  useRevokePermission,
  useAvailablePermissions,
} from "@/hooks/permission/usePermission";
import { useUsers } from "@/hooks/user/useUser";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { useTranslations } from "next-intl";
import type { Role } from "@/types/role.types";
import type { User } from "@/types/user.types";
import type {
  Permission,
  CreatePermissionData,
  UpdatePermissionData,
} from "@/hooks/permission/permission.types";

type PermissionAction = CreatePermissionData["action"];

// Helper Functions
type HierarchyVariant = "destructive" | "default" | "secondary" | "outline";

type HierarchyInfo = {
  variant: HierarchyVariant;
  label: string;
  color: string;
  Icon: LucideIcon;
};

const getHierarchyInfo = (level?: number) => {
  const hierarchyMap: Record<number, HierarchyInfo> = {
    1: {
      variant: "destructive",
      label: "Super Admin",
      color: "text-red-600",
      Icon: Crown,
    },
    2: {
      variant: "default",
      label: "Admin",
      color: "text-blue-600",
      Icon: Shield,
    },
    3: {
      variant: "secondary",
      label: "Manager",
      color: "text-purple-600",
      Icon: Star,
    },
    4: {
      variant: "outline",
      label: "Staff",
      color: "text-green-600",
      Icon: Users,
    },
    5: {
      variant: "outline",
      label: "User",
      color: "text-gray-600",
      Icon: Users,
    },
  };

  const safeLevel = level ?? 0;
  return (
    hierarchyMap[safeLevel] ?? {
      variant: "outline",
      label: `Level ${safeLevel}`,
      color: "text-gray-600",
      Icon: Shield,
    }
  );
};

const getActionColor = (action: string) => {
  const colors: Record<string, string> = {
    CREATE:
      "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400",
    READ: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400",
    UPDATE:
      "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400",
    DELETE:
      "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400",
    MANAGE:
      "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-400",
    EXECUTE:
      "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400",
  };
  return (
    colors[action] ||
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
  );
};

export default function RolePermissionManagement() {
  const [activeTab, setActiveTab] = useState("roles");
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [assignPermissionOpen, setAssignPermissionOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRoleOpen, setEditRoleOpen] = useState(false);
  const [createPermissionOpen, setCreatePermissionOpen] = useState(false);
  const [editPermissionOpen, setEditPermissionOpen] = useState(false);
  const [viewRoleOpen, setViewRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermission, setSelectedPermission] =
    useState<Permission | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
    [],
  );
  const [permissionSearchQuery, setPermissionSearchQuery] = useState("");
  const [roleSearchQuery, setRoleSearchQuery] = useState("");
  const [roleFilterLevel, setRoleFilterLevel] = useState<string>("all");
  const [permissionFilterAction, setPermissionFilterAction] = useState<
    PermissionAction | "all"
  >("all");
  const [permissionFilterStatus, setPermissionFilterStatus] =
    useState<string>("all");
  const [availablePermissionSearchQuery, setAvailablePermissionSearchQuery] =
    useState("");
  const [revokeUserId, setRevokeUserId] = useState("");
  const [revokeRoleId, setRevokeRoleId] = useState("");
  const [createPermissionAction, setCreatePermissionAction] =
    useState<PermissionAction>("READ");

  // Pagination states
  const [permissionPage, setPermissionPage] = useState(1);
  const [permissionLimit] = useState(30);
  const [rolePage, setRolePage] = useState(1);
  const [roleLimit] = useState(10);

  const t = useTranslations("rolePermission");
  const tc = useTranslations("common");

  // API Hooks
  const {
    data: rolesData,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = useRoles({
    page: rolePage,
    limit: roleLimit,
    search: roleSearchQuery,
    hierarchyLevel:
      roleFilterLevel !== "all" ? Number(roleFilterLevel) : undefined,
  });

  const {
    data: permissionsData,
    isLoading: permissionsLoading,
    refetch: refetchPermissions,
  } = usePermissions({
    page: permissionPage,
    limit: permissionLimit,
    search: permissionSearchQuery,
    action:
      permissionFilterAction !== "all" ? permissionFilterAction : undefined,
    isActive:
      permissionFilterStatus === "all"
        ? undefined
        : permissionFilterStatus === "active",
  });

  // Queries with full state
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
    isError: isUsersError,
    isFetching: isUsersFetching,
  } = useUsers({ page: 1, limit: 100 });

  const roles = rolesData?.roles ?? [];
  const permissions = permissionsData?.permissions ?? [];
  const users = usersData?.users ?? [];
  const rolePagination = rolesData?.pagination;
  const permissionPagination = permissionsData?.pagination;

  const totalRoles = rolePagination?.total || 0;
  const totalRolePages = rolePagination?.totalPages || 1;
  const startRoleIndex = (rolePage - 1) * roleLimit + 1;
  const endRoleIndex = Math.min(rolePage * roleLimit, totalRoles);

  const totalPermissions = permissionPagination?.total || 0;
  const totalPermissionPages = permissionPagination?.totalPages || 1;
  const startPermissionIndex = (permissionPage - 1) * permissionLimit + 1;
  const endPermissionIndex = Math.min(
    permissionPage * permissionLimit,
    totalPermissions,
  );

  const {
    data: availablePermissionsData,
    isLoading: availablePermissionsLoading,
  } = useAvailablePermissions(
    selectedRole?.id || 0,
    { limit: 1000 }, // <--- Request 1000 items
    !!selectedRole, // enabled flag
  );

  const availablePermissions = availablePermissionsData?.permissions;

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();
  const assignRoleMutation = useAssignRole();
  const revokeRoleMutation = useRevokeRole();

  const createPermissionMutation = useCreatePermission();
  const updatePermissionMutation = useUpdatePermission();
  const deactivatePermissionMutation = useDeactivatePermission();
  const assignPermissionMutation = useAssignPermission();
  const revokePermissionMutation = useRevokePermission();

  const filteredAvailablePermissions = useMemo(() => {
    const q = availablePermissionSearchQuery.trim().toLowerCase();
    const list = availablePermissions ?? [];
    if (!q) return list;
    return list.filter((permission: Permission) => {
      return (
        permission.permissionName?.toLowerCase().includes(q) ||
        permission.permissionCode?.toLowerCase().includes(q) ||
        permission.resource?.toLowerCase().includes(q)
      );
    });
  }, [availablePermissions, availablePermissionSearchQuery]);

  const togglePermission = (permissionId: number) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const handleAssignRole = async () => {
    const userId = Number(selectedUserId);
    if (!Number.isFinite(userId) || selectedRoleIds.length === 0) return;

    for (const roleId of selectedRoleIds) {
      await assignRoleMutation.mutateAsync({
        userId,
        roleIds: selectedRoleIds,
      });
    }

    setAssignRoleOpen(false);
    setSelectedUserId("");
    setSelectedRoleIds([]);
  };

  const handleAssignPermissions = async () => {
    if (!selectedRole || selectedPermissionIds.length === 0) return;

    try {
      for (const permissionId of selectedPermissionIds) {
        await assignPermissionMutation.mutateAsync({
          roleId: selectedRole.id,
          permissionId,
        });
      }

      setAssignPermissionOpen(false);
      setSelectedPermissionIds([]);
      setAvailablePermissionSearchQuery("");
    } catch (error) {
      console.error("Error assigning permissions:", error);
    }
  };

  const handleRevokePermission = () => {
    if (!selectedRole || !selectedPermission) return;
    revokePermissionMutation.mutate({
      roleId: selectedRole.id,
      permissionId: selectedPermission.id,
    });
  };

  const handleRevokeRole = () => {
    const userId = Number(revokeUserId);
    const roleId = Number(revokeRoleId);
    if (!Number.isFinite(userId) || !Number.isFinite(roleId)) return;
    revokeRoleMutation.mutate({ userId, roleId });
  };

  const handleCreateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roleData = {
      roleName: formData.get("roleName") as string,
      roleCode: formData.get("roleCode") as string,
      hierarchyLevel: Number(formData.get("hierarchyLevel")),
      description: formData.get("description") as string,
    };

    createRoleMutation.mutate(roleData, {
      onSuccess: () => {
        setCreateRoleOpen(false);
        e.currentTarget.reset();
      },
    });
  };

  const handleUpdateRole = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedRole) return;

    const formData = new FormData(e.currentTarget);
    const roleData = {
      roleName: formData.get("roleName") as string,
      roleCode: formData.get("roleCode") as string,
      hierarchyLevel: Number(formData.get("hierarchyLevel")),
      description: formData.get("description") as string,
    };

    updateRoleMutation.mutate(
      { id: selectedRole.id, data: roleData },
      {
        onSuccess: () => {
          setEditRoleOpen(false);
          setSelectedRole(null);
        },
      },
    );
  };

  const handleDeleteRole = (roleId: number) => {
    if (confirm("Are you sure you want to delete this role?")) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  const handleCreatePermission = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const permissionData: CreatePermissionData = {
      permissionName: formData.get("permissionName") as string,
      permissionCode: formData.get("permissionCode") as string,
      resource: formData.get("resource") as string,
      action: ((formData.get("action") as string | null) ??
        "READ") as PermissionAction,
      description: formData.get("description") as string,
    };

    createPermissionMutation.mutate(permissionData, {
      onSuccess: () => {
        setCreatePermissionOpen(false);
        e.currentTarget.reset();
        setCreatePermissionAction("READ");
      },
    });
  };

  const handleUpdatePermission = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPermission) return;

    const formData = new FormData(e.currentTarget);
    const permissionData: UpdatePermissionData = {
      permissionName: formData.get("permissionName") as string,
      permissionCode: formData.get("permissionCode") as string,
      resource: formData.get("resource") as string,
      action: formData.get("action") as PermissionAction,
      description: formData.get("description") as string,
    };

    updatePermissionMutation.mutate(
      { id: selectedPermission.id, data: permissionData },
      {
        onSuccess: () => {
          setEditPermissionOpen(false);
          setSelectedPermission(null);
        },
      },
    );
  };

  const handleTogglePermissionStatus = (permission: Permission) => {
    if (permission.isActive) {
      deactivatePermissionMutation.mutate(permission.id);
    } else {
      updatePermissionMutation.mutate({
        id: permission.id,
        data: { ...permission, isActive: true },
      });
    }
  };

  const clearRoleFilters = () => {
    setRoleSearchQuery("");
    setRoleFilterLevel("all");
  };

  const clearPermissionFilters = () => {
    setPermissionSearchQuery("");
    setPermissionFilterAction("all");
    setPermissionFilterStatus("all");
  };

  return (
    <PermissionGuard role="SUPER_ADMIN" redirectTo="/dashboard">
      <div className="space-y-4 p-2">
        {/* Header Section */}
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-primary/3 to-background p-8">
          <div className="absolute inset-0 bg-grid-white/10" />
          <div className="relative flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {t("title")}
                  </h1>
                  <p className="text-primary">{t("description")}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  refetchRoles();
                  refetchPermissions();
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreateRoleOpen(true)}
                className="gap-2"
              >
                <ShieldPlus className="h-4 w-4" />
                {t("createRole")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setCreatePermissionOpen(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t("createPermission")}
              </Button>
              <Dialog open={assignRoleOpen} onOpenChange={setAssignRoleOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 shadow-lg">
                    <UserPlus className="h-4 w-4" />
                    {t("assignRole")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <UserPlus className="h-5 w-5 text-primary" />
                      </div>
                      {t("assignRoleTitle")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("assignRoleDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-select">{t("selectUser")}</Label>
                      <Select
                        value={selectedUserId}
                        onValueChange={setSelectedUserId}
                      >
                        <SelectTrigger id="user-select">
                          <SelectValue placeholder="Choose a user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {usersLoading || isUsersFetching ? (
                            <SelectItem value="__loading" disabled>
                              Loading users...
                            </SelectItem>
                          ) : isUsersError ? (
                            <SelectItem value="__error" disabled>
                              {usersError instanceof Error
                                ? usersError.message
                                : "Failed to load users"}
                            </SelectItem>
                          ) : users.length === 0 ? (
                            <SelectItem value="__empty" disabled>
                              No users found
                            </SelectItem>
                          ) : (
                            users.map((user: User) => {
                              const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
                              const username = (user as unknown as { username?: string }).username;
                              return (
                                <SelectItem
                                  key={user.id}
                                  value={user.id.toString()}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {fullName || username || `User #${user.id}`}
                                      {fullName && username && (
                                        <span className="text-muted-foreground ml-1">@{username}</span>
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {user.email}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      {(isUsersError || users.length === 0) && (
                        <div className="space-y-2">
                          <Label htmlFor="user-id-manual">
                            Or enter User ID
                          </Label>
                          <Input
                            id="user-id-manual"
                            inputMode="numeric"
                            placeholder="e.g. 123"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t("selectRole")}</Label>
                      <div className="border rounded-lg p-2 max-h-[200px] overflow-y-auto space-y-1">
                        {roles.map((role: Role) => {
                          const hierarchyInfo = getHierarchyInfo(
                            role.hierarchyLevel,
                          );
                          const IconComponent = hierarchyInfo.Icon;
                          return (
                            <div
                              key={role.id}
                              className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50"
                            >
                              <Checkbox
                                id={`role-${role.id}`}
                                checked={selectedRoleIds.includes(role.id)}
                                onCheckedChange={() => {
                                  setSelectedRoleIds((prev) =>
                                    prev.includes(role.id)
                                      ? prev.filter((id) => id !== role.id)
                                      : [...prev, role.id],
                                  );
                                }}
                              />
                              <label
                                htmlFor={`role-${role.id}`}
                                className="flex items-center gap-2 cursor-pointer flex-1"
                              >
                                <IconComponent
                                  className={`h-4 w-4 ${hierarchyInfo.color}`}
                                />
                                <span>{role.roleName}</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setAssignRoleOpen(false)}
                    >
                      {tc("cancel")}
                    </Button>
                    <Button
                      onClick={handleAssignRole}
                      disabled={
                        !selectedUserId ||
                        selectedRoleIds.length === 0 ||
                        assignRoleMutation.isPending
                      }
                      className="gap-2"
                    >
                      {assignRoleMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("assigning")}
                        </>
                      ) : (
                        <>
                          <Link2 className="h-4 w-4" />
                          {t("assignRole")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("totalRoles")}
                  </p>
                  <p className="text-3xl font-bold">{totalRoles}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {t("activeRoles")}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("activePermissions")}
                  </p>
                  <p className="text-3xl font-bold">
                    {permissions.filter((p: Permission) => p.isActive).length}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    {t("acrossAllRoles")}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-xl">
                  <FileKey className="h-6 w-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("totalPermissions")}
                  </p>
                  <p className="text-3xl font-bold">{totalPermissions}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {t("systemWide")}
                  </p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-xl">
                  <Key className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-3 h-12">
            <TabsTrigger value="roles" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              {t("roles")} ({totalRoles})
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="flex items-center gap-2"
            >
              <FileKey className="h-4 w-4" />
              {t("permissions")} ({totalPermissions})
            </TabsTrigger>
            <TabsTrigger
              value="assignments"
              className="flex items-center gap-2"
            >
              <Link2 className="h-4 w-4" />
              {t("assignments")}
            </TabsTrigger>
          </TabsList>

          {/* Roles Tab Content - Similar structure to original, updated with fixed handlers */}
          <TabsContent value="roles" className="mt-6 space-y-4">
            {/* Search and Filter Bar */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("searchRolesPlaceholder")}
                      value={roleSearchQuery}
                      onChange={(e) => setRoleSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={roleFilterLevel}
                    onValueChange={setRoleFilterLevel}
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("allLevels")}</SelectItem>
                      <SelectItem value="1">{t("level1SuperAdmin")}</SelectItem>
                      <SelectItem value="2">
                        {t("level2PropertyManager")}
                      </SelectItem>
                      <SelectItem value="3">{t("level3DataEntry")}</SelectItem>
                      <SelectItem value="4">{t("level4Viewer")}</SelectItem>
                      <SelectItem value="5">{t("level5User")}</SelectItem>
                    </SelectContent>
                  </Select>
                  {(roleSearchQuery || roleFilterLevel !== "all") && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={clearRoleFilters}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rest of roles table implementation */}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle>{t("roles")}</CardTitle>
                  <CardDescription>
                    Manage system roles and hierarchy levels
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setCreateRoleOpen(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t("createRole")}
                </Button>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading roles...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Role</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Hierarchy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roles.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No roles found
                          </TableCell>
                        </TableRow>
                      ) : (
                        roles.map((role) => {
                          const h = getHierarchyInfo(role.hierarchyLevel);
                          return (
                            <TableRow key={role.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <h.Icon className={`h-4 w-4 ${h.color}`} />
                                  <span>{role.roleName}</span>
                                  {role.isSystem && (
                                    <Badge variant="secondary">System</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{role.roleCode}</TableCell>
                              <TableCell>
                                <Badge variant={h.variant}>{h.label}</Badge>
                              </TableCell>
                              <TableCell>
                                {role.isActive ? (
                                  <Badge variant="success" className="gap-1">
                                    <CheckCircle className="h-3 w-3" /> Active
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="gap-1">
                                    <XCircle className="h-3 w-3" /> Inactive
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setViewRoleOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setEditRoleOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={role.isSystem}
                                    onClick={() => handleDeleteRole(role.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    {totalRoles === 0
                      ? "No roles"
                      : `Showing ${startRoleIndex}-${endRoleIndex} of ${totalRoles}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={rolePage <= 1}
                      onClick={() => setRolePage(1)}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={rolePage <= 1}
                      onClick={() => setRolePage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm">
                      {rolePage} / {totalRolePages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={rolePage >= totalRolePages}
                      onClick={() =>
                        setRolePage((p) => Math.min(totalRolePages, p + 1))
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={rolePage >= totalRolePages}
                      onClick={() => setRolePage(totalRolePages)}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("permissions")}</CardTitle>
                <CardDescription>
                  Manage permissions used by roles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t("searchPermissionsPlaceholder")}
                      value={permissionSearchQuery}
                      onChange={(e) => setPermissionSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={permissionFilterAction}
                    onValueChange={(v) =>
                      setPermissionFilterAction(v as PermissionAction | "all")
                    }
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="CREATE">CREATE</SelectItem>
                      <SelectItem value="READ">READ</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="MANAGE">MANAGE</SelectItem>
                      <SelectItem value="EXECUTE">EXECUTE</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={permissionFilterStatus}
                    onValueChange={setPermissionFilterStatus}
                  >
                    <SelectTrigger className="w-full md:w-[180px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  {(permissionSearchQuery ||
                    permissionFilterAction !== "all" ||
                    permissionFilterStatus !== "all") && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={clearPermissionFilters}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {permissionsLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading permissions...
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Permission</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Resource</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permissions.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-10 text-muted-foreground"
                          >
                            No permissions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        permissions.map((permission) => (
                          <TableRow key={permission.id}>
                            <TableCell className="font-medium">
                              {permission.permissionName}
                            </TableCell>
                            <TableCell>{permission.permissionCode}</TableCell>
                            <TableCell>{permission.resource}</TableCell>
                            <TableCell>
                              <Badge
                                className={getActionColor(permission.action)}
                                variant="outline"
                              >
                                {permission.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {permission.isActive ? (
                                <Badge variant="success" className="gap-1">
                                  <CheckCircle className="h-3 w-3" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="gap-1">
                                  <XCircle className="h-3 w-3" /> Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedPermission(permission);
                                    setEditPermissionOpen(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleTogglePermissionStatus(permission)
                                  }
                                  disabled={
                                    deactivatePermissionMutation.isPending ||
                                    updatePermissionMutation.isPending
                                  }
                                >
                                  {permission.isActive ? (
                                    <XCircle className="h-4 w-4 text-destructive" />
                                  ) : (
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    {totalPermissions === 0
                      ? "No permissions"
                      : `Showing ${startPermissionIndex}-${endPermissionIndex} of ${totalPermissions}`}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={permissionPage <= 1}
                      onClick={() => setPermissionPage(1)}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={permissionPage <= 1}
                      onClick={() =>
                        setPermissionPage((p) => Math.max(1, p - 1))
                      }
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-2 text-sm">
                      {permissionPage} / {totalPermissionPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={permissionPage >= totalPermissionPages}
                      onClick={() =>
                        setPermissionPage((p) =>
                          Math.min(totalPermissionPages, p + 1),
                        )
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={permissionPage >= totalPermissionPages}
                      onClick={() => setPermissionPage(totalPermissionPages)}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assignments" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("assignments")}</CardTitle>
                <CardDescription>
                  Assign and revoke permissions for a role
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Revoke role from user
                    </CardTitle>
                    <CardDescription>
                      Remove a specific role from a user
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>User</Label>
                      <Select
                        value={revokeUserId}
                        onValueChange={setRevokeUserId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a user..." />
                        </SelectTrigger>
                        <SelectContent>
                          {usersLoading || isUsersFetching ? (
                            <SelectItem value="__loading" disabled>
                              Loading users...
                            </SelectItem>
                          ) : isUsersError ? (
                            <SelectItem value="__error" disabled>
                              {usersError instanceof Error
                                ? usersError.message
                                : "Failed to load users"}
                            </SelectItem>
                          ) : users.length === 0 ? (
                            <SelectItem value="__empty" disabled>
                              No users found
                            </SelectItem>
                          ) : (
                            users.map((user) => {
                              const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
                              const username = (user as unknown as { username?: string }).username;
                              return (
                                <SelectItem key={user.id} value={String(user.id)}>
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {fullName || username || `User #${user.id}`}
                                      {fullName && username && (
                                        <span className="text-muted-foreground ml-1">@{username}</span>
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {user.email}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      {(isUsersError || users.length === 0) && (
                        <div className="space-y-2">
                          <Label htmlFor="revoke-user-id-manual">
                            Or enter User ID
                          </Label>
                          <Input
                            id="revoke-user-id-manual"
                            inputMode="numeric"
                            placeholder="e.g. 123"
                            value={revokeUserId}
                            onChange={(e) => setRevokeUserId(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={revokeRoleId}
                        onValueChange={setRevokeRoleId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a role..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={String(role.id)}>
                              {role.roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        variant="destructive"
                        className="gap-2"
                        disabled={
                          !revokeUserId ||
                          !revokeRoleId ||
                          revokeRoleMutation.isPending
                        }
                        onClick={handleRevokeRole}
                      >
                        <Unlink className="h-4 w-4" />
                        {revokeRoleMutation.isPending
                          ? "Revoking..."
                          : "Revoke role"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("selectRole")}</Label>
                    <Select
                      value={selectedRole?.id ? String(selectedRole.id) : ""}
                      onValueChange={(value) => {
                        const roleId = Number(value);
                        const found =
                          roles.find((r) => r.id === roleId) ?? null;
                        setSelectedRole(found);
                        setSelectedPermissionIds([]);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.roleName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Permission</Label>
                    <Select
                      value={
                        selectedPermission?.id
                          ? String(selectedPermission.id)
                          : ""
                      }
                      onValueChange={(value) => {
                        const permissionId = Number(value);
                        const found =
                          permissions.find((p) => p.id === permissionId) ??
                          null;
                        setSelectedPermission(found);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a permission..." />
                      </SelectTrigger>
                      <SelectContent>
                        {permissions.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.permissionName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={!selectedRole}
                      onClick={() => setAssignPermissionOpen(true)}
                    >
                      <ShieldPlus className="h-4 w-4" /> Assign
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      disabled={
                        !selectedRole ||
                        !selectedPermission ||
                        revokePermissionMutation.isPending
                      }
                      onClick={handleRevokePermission}
                    >
                      <Unlink className="h-4 w-4" />
                      {revokePermissionMutation.isPending
                        ? "Revoking..."
                        : "Revoke"}
                    </Button>
                  </div>
                </div>

                <Dialog
                  open={assignPermissionOpen}
                  onOpenChange={setAssignPermissionOpen}
                >
                  <DialogContent className="sm:max-w-[650px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ShieldPlus className="h-5 w-5 text-primary" /> Assign
                        permissions
                      </DialogTitle>
                      <DialogDescription>
                        Select permissions to add to the chosen role
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search permissions..."
                          value={availablePermissionSearchQuery}
                          onChange={(e) =>
                            setAvailablePermissionSearchQuery(e.target.value)
                          }
                          className="pl-9"
                        />
                      </div>

                      {availablePermissionsLoading ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading available permissions...
                        </div>
                      ) : (
                        <div className="border rounded-lg p-2 max-h-[320px] overflow-y-auto space-y-1">
                          {filteredAvailablePermissions.length === 0 ? (
                            <p className="text-sm text-muted-foreground p-3">
                              No permissions available
                            </p>
                          ) : (
                            filteredAvailablePermissions.map((permission) => (
                              <div
                                key={permission.id}
                                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                              >
                                <Checkbox
                                  checked={selectedPermissionIds.includes(
                                    permission.id,
                                  )}
                                  onCheckedChange={() =>
                                    togglePermission(permission.id)
                                  }
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {permission.permissionName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.permissionCode} •{" "}
                                    {permission.resource}
                                  </p>
                                </div>
                                <Badge
                                  className={getActionColor(permission.action)}
                                  variant="outline"
                                >
                                  {permission.action}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setAssignPermissionOpen(false)}
                      >
                        {tc("cancel")}
                      </Button>
                      <Button
                        onClick={handleAssignPermissions}
                        disabled={
                          !selectedRole ||
                          selectedPermissionIds.length === 0 ||
                          assignPermissionMutation.isPending
                        }
                        className="gap-2"
                      >
                        {assignPermissionMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />{" "}
                            Assigning...
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4" /> Assign
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Role Dialog */}
        <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <form onSubmit={handleCreateRole} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t("createRole")}</DialogTitle>
                <DialogDescription>Create a new role</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input id="roleName" name="roleName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleCode">Role Code</Label>
                  <Input id="roleCode" name="roleCode" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hierarchyLevel">Hierarchy Level</Label>
                  <Input
                    id="hierarchyLevel"
                    name="hierarchyLevel"
                    type="number"
                    min={1}
                    max={10}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateRoleOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createRoleMutation.isPending}
                  className="gap-2"
                >
                  {createRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={editRoleOpen} onOpenChange={setEditRoleOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t("editRole")}</DialogTitle>
                <DialogDescription>Update role details</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name</Label>
                  <Input
                    id="roleName"
                    name="roleName"
                    defaultValue={selectedRole?.roleName ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roleCode">Role Code</Label>
                  <Input
                    id="roleCode"
                    name="roleCode"
                    defaultValue={selectedRole?.roleCode ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hierarchyLevel">Hierarchy Level</Label>
                  <Input
                    id="hierarchyLevel"
                    name="hierarchyLevel"
                    type="number"
                    min={1}
                    max={10}
                    defaultValue={selectedRole?.hierarchyLevel ?? 1}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={selectedRole?.description ?? ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditRoleOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={updateRoleMutation.isPending}
                  className="gap-2"
                >
                  {updateRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Role Dialog */}
        <Dialog open={viewRoleOpen} onOpenChange={setViewRoleOpen}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" /> Role details
              </DialogTitle>
              <DialogDescription>Quick view of the role</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="font-medium">
                  {selectedRole?.roleName ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Code</span>
                <span className="font-medium">
                  {selectedRole?.roleCode ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Level</span>
                <span className="font-medium">
                  {selectedRole?.hierarchyLevel ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {selectedRole?.isActive ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle className="h-3 w-3" /> Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <XCircle className="h-3 w-3" /> Inactive
                  </Badge>
                )}
              </div>
              {selectedRole?.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{selectedRole.description}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewRoleOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Permission Dialog */}
        <Dialog
          open={createPermissionOpen}
          onOpenChange={setCreatePermissionOpen}
        >
          <DialogContent className="sm:max-w-[560px]">
            <form onSubmit={handleCreatePermission} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t("createPermission")}</DialogTitle>
                <DialogDescription>Create a new permission</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="permissionName">Name</Label>
                  <Input id="permissionName" name="permissionName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permissionCode">Code</Label>
                  <Input id="permissionCode" name="permissionCode" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource">Resource</Label>
                  <Input id="resource" name="resource" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <input
                    type="hidden"
                    name="action"
                    value={createPermissionAction}
                  />
                  <Select
                    value={createPermissionAction}
                    onValueChange={(v) =>
                      setCreatePermissionAction(v as PermissionAction)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CREATE">CREATE</SelectItem>
                      <SelectItem value="READ">READ</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                      <SelectItem value="MANAGE">MANAGE</SelectItem>
                      <SelectItem value="EXECUTE">EXECUTE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreatePermissionOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={createPermissionMutation.isPending}
                  className="gap-2"
                >
                  {createPermissionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Creating...
                    </>
                  ) : (
                    "Create"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Permission Dialog */}
        <Dialog open={editPermissionOpen} onOpenChange={setEditPermissionOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <form onSubmit={handleUpdatePermission} className="space-y-4">
              <DialogHeader>
                <DialogTitle>{t("editPermission")}</DialogTitle>
                <DialogDescription>Update permission</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="permissionName">Name</Label>
                  <Input
                    id="permissionName"
                    name="permissionName"
                    defaultValue={selectedPermission?.permissionName ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permissionCode">Code</Label>
                  <Input
                    id="permissionCode"
                    name="permissionCode"
                    defaultValue={selectedPermission?.permissionCode ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resource">Resource</Label>
                  <Input
                    id="resource"
                    name="resource"
                    defaultValue={selectedPermission?.resource ?? ""}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Input
                    id="action"
                    name="action"
                    defaultValue={selectedPermission?.action ?? "READ"}
                    required
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={selectedPermission?.description ?? ""}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditPermissionOpen(false)}
                >
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={updatePermissionMutation.isPending}
                  className="gap-2"
                >
                  {updatePermissionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
