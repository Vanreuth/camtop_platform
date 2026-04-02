// src/hooks/notification/useNotification.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notificationApi } from "./notification.api";
import { getApiErrorMessage, getApiErrorDescription } from "@/utils/helpers";
import type { Notification } from "./notification.api";

const EMPTY_NOTIFICATIONS: Notification[] = [];

// =========================
// TYPES
// =========================
export type MyNotificationParams = {
  unreadOnly?: boolean;
  limit?: number;
  skip?: number;
};

export type AdminNotificationParams = {
  userId?: number;
  type?: string;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  skip?: number;
};

export type AdminCreateNotificationPayload = {
  userId: number;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

export type AdminSendManyPayload = {
  userIds: number[];
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

export type AdminSendPrivilegedPayload = {
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
};

export type AdminPrunePayload = {
  daysOld: number;
  onlyRead?: boolean;
};



// =========================
// QUERY KEYS (stable)
// =========================
export const notificationKeys = {
  all: ["notifications"] as const,

  // USER
  my: () => [...notificationKeys.all, "me"] as const,
  myList: (params?: MyNotificationParams) =>
    [
      ...notificationKeys.my(),
      {
        unreadOnly: params?.unreadOnly ?? false,
        limit: params?.limit ?? 50,
        skip: params?.skip ?? 0,
      },
    ] as const,

  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,

  // ADMIN
  admin: () => [...notificationKeys.all, "admin"] as const,

  adminList: (params?: AdminNotificationParams) =>
    [
      ...notificationKeys.admin(),
      "list",
      {
        userId: params?.userId ?? null,
        type: params?.type ?? null,
        isRead: typeof params?.isRead === "boolean" ? params.isRead : null,
        dateFrom: params?.dateFrom ?? null,
        dateTo: params?.dateTo ?? null,
        limit: params?.limit ?? 50,
        skip: params?.skip ?? 0,
      },
    ] as const,

  adminUser: (userId: number, params?: MyNotificationParams) =>
    [
      ...notificationKeys.admin(),
      "user",
      userId,
      {
        unreadOnly: params?.unreadOnly ?? false,
        limit: params?.limit ?? 50,
        skip: params?.skip ?? 0,
      },
    ] as const,

  adminDetail: (id: number) => [...notificationKeys.admin(), "detail", id] as const,
};

// =========================
// QUERIES
// =========================
export function useMyNotifications(params?: MyNotificationParams, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: notificationKeys.myList(params),
    queryFn: () => notificationApi.getNotifications(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useUnreadCount(options?: {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
}) {
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    enabled,
    placeholderData: (prev) => prev,
    refetchInterval: options?.refetchInterval ?? 30000,
    refetchIntervalInBackground: options?.refetchIntervalInBackground ?? false,
    staleTime: 5000,
  });
}

export function useAdminNotifications(params?: AdminNotificationParams, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? false;

  return useQuery({
    queryKey: notificationKeys.adminList(params),
    queryFn: () => notificationApi.adminGetAllNotifications(params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

// optional (if you want admin get one user list)
// requires API: GET /notifications/user/:userId
export function useAdminUserNotifications(
  userId: number,
  params?: MyNotificationParams,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? !!userId;

  return useQuery({
    queryKey: notificationKeys.adminUser(userId, params),
    queryFn: () => notificationApi.adminGetUserNotifications(userId, params),
    enabled,
    placeholderData: (prev) => prev,
  });
}

// =========================
// MUTATIONS (USER)
// =========================
export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.my() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to mark as read"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.my() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      toast.success("All notifications marked as read");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to mark all as read"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => notificationApi.deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.my() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
      toast.success("Notification deleted");
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete notification"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// =========================
// MUTATIONS (ADMIN)
// =========================
function invalidateAdmin(queryClient: ReturnType<typeof useQueryClient>, userId?: number) {
  queryClient.invalidateQueries({ queryKey: notificationKeys.admin() });
  if (userId != null) {
    queryClient.invalidateQueries({ queryKey: notificationKeys.adminUser(userId) });
  }
}

export function useAdminCreateNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminCreateNotificationPayload) =>
      notificationApi.adminCreateNotification(payload),

    onSuccess: (_res, variables) => {
      invalidateAdmin(queryClient, variables.userId);
      toast.success("Notification created");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to create notification"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

export function useAdminSendAllUsers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      type: string;
      title: string;
      message: string;
      entityType?: string;
      entityId?: number;
      actionUrl?: string;
    }) => notificationApi.adminSendAllUsers(payload),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.admin() });
      toast.success("Sent to all users");
    },

    onError: (error) => {
      const message = getApiErrorMessage(error, "Failed to send to all users");
      const description = getApiErrorDescription(error);
      toast.error(message, { description });
    },
  });
}

export function useAdminSendPrivileged() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminSendPrivilegedPayload) =>
      notificationApi.adminSendPrivileged(payload),

    onSuccess: () => {
      invalidateAdmin(queryClient);
      toast.success("Sent to privileged users");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to send to privileged users"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}
// 1. DELETE SPECIFIC USER NOTIFICATION (Existing)
export function useAdminDeleteUserNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { userId: number; notificationId: number }) =>
      notificationApi.adminDeleteUserNotification(payload.userId, payload.notificationId),

    onSuccess: (_res, variables) => {
      invalidateAdmin(queryClient, variables.userId);
      toast.success("Notification deleted");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete notification"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// 2. FORCE DELETE (Any notification ID) 
export function useAdminForceDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: number) => 
      notificationApi.adminForceDelete(notificationId),

    onSuccess: () => {
      // Invalidate all admin lists since we don't know the owner
      invalidateAdmin(queryClient); 
      toast.success("Notification force deleted");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to force delete"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// 3. BULK DELETE (Multiple IDs) 
export function useAdminBulkDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => 
      notificationApi.adminBulkDelete(ids),

    onSuccess: (data) => {
      invalidateAdmin(queryClient);
      toast.success(`${data.data.count} notifications deleted`);
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to bulk delete"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// 4. PRUNE (Maintenance) 
export function useAdminPrune() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: AdminPrunePayload) => 
      notificationApi.adminPruneNotifications(payload.daysOld, payload.onlyRead),

    onSuccess: (data) => {
      invalidateAdmin(queryClient);
      toast.success(`Pruned ${data.data.count} old notifications`);
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to prune notifications"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

export function useAdminClearUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: number) => notificationApi.adminClearUserInbox(userId),

    onSuccess: (_data, userId) => {
      // 1. Invalidate that specific user's view in admin panel
      queryClient.invalidateQueries({ queryKey: notificationKeys.adminUser(userId) });
      // 2. Invalidate the main list as counts might change
      queryClient.invalidateQueries({ queryKey: notificationKeys.adminList() });
      
      toast.success(`User ${userId}'s inbox cleared`);
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to clear user inbox"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// 6. DELETE BY TYPE (e.g. Remove all 'SYSTEM' notifications)
export function useAdminDeleteByType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: string) => notificationApi.adminDeleteByType(type),

    onSuccess: (_data, type) => {
      // Invalidate everything as this affects global data
      invalidateAdmin(queryClient); 
      toast.success(`All notifications of type '${type}' deleted`);
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to delete by type"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// 7. SYSTEM RESET (Truncate table)
export function useAdminTruncate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.adminTruncate(),

    onSuccess: () => {
      // Reset all admin views
      invalidateAdmin(queryClient);
      
      // Also reset the current user's view (since everything is gone)
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      
      toast.success("System Reset: All notifications deleted");
    },

    onError: (error) => {
      toast.error(getApiErrorMessage(error, "Failed to reset system"), {
        description: getApiErrorDescription(error),
      });
    },
  });
}

// =========================
// COMBINED USER HOOK (same as you have)
// =========================
export function useNotifications(
  params?: MyNotificationParams,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const my = useMyNotifications(params, { enabled });
  const unread = useUnreadCount({ enabled });
  const raw = my.data as unknown;
  const root =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const dataNode = root?.data;
  const data =
    dataNode && typeof dataNode === "object"
      ? (dataNode as Record<string, unknown>)
      : null;
  const notifications = Array.isArray(data?.notifications)
    ? (data.notifications as Notification[])
    : Array.isArray(root?.notifications)
      ? (root.notifications as Notification[])
      : Array.isArray(dataNode)
        ? (dataNode as Notification[])
        : EMPTY_NOTIFICATIONS;

  const markOne = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const del = useDeleteNotification();

  return {
    notifications,
    unreadCount: unread.data ?? 0,
    isLoading: my.isLoading || unread.isLoading,
    isError: my.isError || unread.isError,

    markAsRead: markOne.mutate,
    markAllAsRead: markAll.mutate,
    deleteNotification: del.mutate,

    isMarkingAsRead: markOne.isPending,
    isMarkingAllAsRead: markAll.isPending,
    isDeleting: del.isPending,

    refetch: () => {
      my.refetch();
      unread.refetch();
    },
  };
}
