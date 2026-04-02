"use client";
import { useState, useMemo } from "react";
import { DataTable } from "@/components/DataTable/DataTable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Activity, UserCog } from "lucide-react";
import { User } from "@/types/user.types";
import { DataTableConfig } from "@/components/DataTable/types";
import { UserCreateDialog } from "@/components/modal/UserCreateDialog";
import { UserEditDialog } from "@/components/modal/UserEditDialog";
import { DeleteDialog } from "@/components/modal/DeleteDialog";
import { UserDetailModal } from "@/components/modal/UserDetail";
import { PermissionGuard } from "@/components/guard/PermissionGuard";
import { Can } from "@/components/guard/Can";
import { useAuth } from "@/hooks/auth/useAuth";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from "@/hooks/user/useUser";

const getRoleBadgeVariant = (roleName: string) => {
  const variants: Record<string, any> = {
    "Super Administrator": "destructive",
    "Property Manager": "success",
    "Data Entry": "info",
    Viewer: "warning",
    User: "outline",
  };
  return variants[roleName] || "outline";
};

// --- HELPER: Convert Object to FormData ---
const toFormData = (values: any): FormData => {
  const formData = new FormData();

  Object.keys(values).forEach((key) => {
    const value = values[key];

    if (key === "profilePicture") {
      // Only append if it's a NEW File object.
      if (value instanceof File) {
        formData.append(key, value);
      }
    } else if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });

  return formData;
};

// --- Table Configuration (built with translations) ---
const createUserTableConfig = (
  tFn: (k: string) => string
): DataTableConfig<User> => ({
  title: tFn("title"),
  description: tFn("description"),
  searchPlaceholder: tFn("searchPlaceholder"),
  defaultPageSize: 10,
  defaultSortBy: "createdAt",
  defaultSortOrder: "desc",
  columns: [
    {
      key: "username",
      label: tFn("userColumn"),
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border">
            {row.profilePicture ? (
              <AvatarImage
                src={row.profilePicture}
                alt={value}
                className="object-cover"
              />
            ) : (
              <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                {row.firstName?.[0]}
                {row.lastName?.[0]}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <div className="font-medium text-sm text-foreground">
              {row.firstName} {row.lastName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              @{value}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "email",
      label: tFn("contactInfo"),
      sortable: true,
      render: (value, row) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-primary">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate max-w-[180px]">{value}</span>
          </div>
          {row.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>{row.phone}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "roles",
      label: tFn("roleColumn"),
      sortable: false,
      render: (roles) => {
        if (!roles || roles.length === 0) {
          return (
            <Badge variant="outline" className="font-normal">
              {tFn("noRole")}
            </Badge>
          );
        }
        return (
          <div className="flex gap-1 flex-wrap">
            {roles.map((r: any) => (
              <Badge
                key={r.roleId}
                variant={getRoleBadgeVariant(r.role?.roleName)}
              >
                {r.role?.roleName || tFn("unknown")}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      key: "status",
      label: tFn("statusColumn"),
      render: (value) => (
        <Badge
          variant="outline"
          className={`
            font-medium border-0
            ${
              value === "ACTIVE"
                ? "bg-green-500/15 text-green-700 hover:bg-green-500/25"
                : "bg-red-500/15 text-red-700 hover:bg-red-500/25"
            }
          `}
        >
          <Activity className="mr-1.5 h-3 w-3" />
          {value}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      label: tFn("joined"),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
    },
  ],
  filters: [
    {
      key: "status",
      label: tFn("statusColumn"),
      type: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
      ],
    },
    {
      key: "role",
      label: tFn("roleColumn"),
      type: "select",
      options: [
        { label: "Super Admin", value: "SUPER_ADMIN" },
        { label: "Property Manager", value: "PROPERTY_MANAGER" },
        { label: "Data Entry", value: "DATA_ENTRY" },
        { label: "Viewer", value: "VIEWER" },
      ],
    },
    {
      key: "dateRange",
      label: tFn("joined"),
      type: "daterange",
    },
  ],
});

export default function UsersPage() {
  // Auth & permissions
  const { hasPermission, hasHierarchyLevel ,isSuperAdmin} = useAuth();
  const t = useTranslations("users");
  const tc = useTranslations("common");

  // Mutations
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  // State for modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // --- Handlers ---

  const handleView = (user: User) => {
    setSelectedUser(user);
    setIsDetailOpen(true);
  };

  const handleEdit = (user: User) => {
    // Check permission before allowing edit
    if (!hasHierarchyLevel(1) && !hasPermission("user:update")) {
      if (!isSuperAdmin()) {
        toast.error(tc("noAccess"), {
          description: t("permissionDeniedEdit"),
        });
        return;
      }
    }
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleDelete = (user: User) => {
    // Check permission before allowing delete
    if (!hasHierarchyLevel(1) && !hasPermission("user:delete")) {
      if (!isSuperAdmin()) {
        toast.error(tc("noAccess"), {
          description: t("permissionDeniedDelete"),
        });
        return;
      }
    }
    setSelectedUser(user);
    setIsDeleteModalOpen(true);
  };

  // 1. CREATE USER
  const handleCreate = (values: any) => {
    // Check permission before creating
    if (!hasHierarchyLevel(1) && !hasPermission("user:create")) {
      if (!isSuperAdmin()) {
        toast.error(tc("noAccess"), {
          description: t("permissionDeniedCreate"),
        });
        return;
      }
    }

    const formData = toFormData(values);

    createMutation.mutate(formData, {
      onSuccess: () => {
        setIsAddModalOpen(false);
      },
    });
  };

  // 2. UPDATE USER
  const handleUpdate = (values: any) => {
    if (!selectedUser) return;

    const formData = toFormData(values);

    updateMutation.mutate(
      { id: selectedUser.id, data: formData },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setSelectedUser(null);
        },
      }
    );
  };

  // 3. DELETE USER
  const handleConfirmDelete = () => {
    if (!selectedUser) return;
    
    // Double-check permission before deleting
    if (!hasHierarchyLevel(1) && !hasPermission("user:delete")) {
      if (!isSuperAdmin()) {
        toast.error(tc("noAccess"), {
          description: t("permissionDeniedDelete"),
        });
        return;
      }
    }

    deleteMutation.mutate(selectedUser.id, {
      onSuccess: () => {
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
      },
    });
  };

  const checkIsSuperAdmin = (user: User): boolean => {
    return (
      user.roles?.some(
        (r: any) =>
          r.role?.roleCode === "SUPER_ADMIN" ||
          r.role?.roleName === "Super Administrator"
      ) ?? false
    );
  };

  // Build translated table config
  const userTableConfig = useMemo(() => createUserTableConfig((k: string) => t(k)), [t]);

  return (
    <PermissionGuard hierarchyLevel={2} redirectTo="/dashboard">
      <div className="space-y-4 p-2">
        {/* Main Data Table */}
        <DataTable<User>
          config={userTableConfig}
          useDataHook={useUsers}
          onView={handleView}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canEdit={(user) => !checkIsSuperAdmin(user)}
          canDelete={(user) =>
            !checkIsSuperAdmin(user) && user.status === "ACTIVE"
          }
          headerActions={
            <Can hierarchyLevel={2} permission="user:create">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
              >
                <UserCog className="mr-2 h-4 w-4" />
                {t("addUser")}
              </Button>
            </Can>
          }
        />

        {/* --- Modals (Always Rendered - Controlled by 'open' prop) --- */}

        {/* ADD Modal */}
        <Can hierarchyLevel={2} permission="user:create">
          <UserCreateDialog
            open={isAddModalOpen}
            onOpenChange={setIsAddModalOpen}
            title={t("addUser")}
            description={t("addUserDescription")}
            onSubmit={handleCreate}
            isLoading={createMutation.isPending}
          />
        </Can>

        {/* EDIT Modal */}
        <Can hierarchyLevel={2} permission="user:update">
          <UserEditDialog
            open={isEditModalOpen}
            onOpenChange={setIsEditModalOpen}
            title={t("editUser")}
            description={t("editUserDescription")}
            initialData={selectedUser}
            onSubmit={handleUpdate}
            isLoading={updateMutation.isPending}
          />
        </Can>

        {/* DELETE Modal */}
        <Can hierarchyLevel={1} permission="user:delete">
          <DeleteDialog
            open={isDeleteModalOpen}
            onOpenChange={setIsDeleteModalOpen}
            itemName={
              selectedUser
                ? `${selectedUser.firstName} ${selectedUser.lastName}`
                : "this user"
            }
            onConfirm={handleConfirmDelete}
            isLoading={deleteMutation.isPending}
          />
        </Can>

        {/* DETAIL Modal */}
        <UserDetailModal
          open={isDetailOpen}
          onOpenChange={setIsDetailOpen}
          user={selectedUser}
          onEdit={() => {
            setIsDetailOpen(false);
            // Small timeout ensures smooth transition between modals
            setTimeout(() => setIsEditModalOpen(true), 150);
          }}
          onDelete={() => {
            setIsDetailOpen(false);
            setTimeout(() => setIsDeleteModalOpen(true), 150);
          }}
        />
      </div>
    </PermissionGuard>
  );
}
