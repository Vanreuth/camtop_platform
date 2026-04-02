import api from "@/lib/api";

export interface NotificationUserSummary {
  id: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePicture?: string | null;
  roles?: Array<{
    role: {
      roleName: string;
      roleCode: string;
      hierarchyLevel: number;
    };
  }>;
}

export interface Notification {
  id: number;
  userId: number;
  createdBy?: number | null;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  actionUrl?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: NotificationUserSummary;
  createdByUser?: NotificationUserSummary | null;
}

export interface NotificationResponse {
  success: boolean;
  data: {
    notifications: Notification[];
    unreadCount: number;
  };
}

export const notificationApi = {
  // =========================
  // USER ENDPOINTS
  // =========================

  // Get notifications
  getNotifications: async (params?: {
    unreadOnly?: boolean;
    limit?: number;
    skip?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append('unreadOnly', 'true');
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.skip) query.append('skip', params.skip.toString());

    const qs = query.toString();
    const { data } = await api.get<NotificationResponse>(
      `/notifications/me${qs ? `?${qs}` : ""}`
    );
    return data;
  },

  // Get unread count
  getUnreadCount: async () => {
    const { data } = await api.get<{ success: boolean; data: { count: number } }>(
      '/notifications/unread-count'
    );
    return data.data.count;
  },

  // Mark as read
  markAsRead: async (notificationId: number) => {
    const { data } = await api.patch(
      `/notifications/${notificationId}/read`
    );
    return data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const { data } = await api.patch('/notifications/read-all');
    return data;
  },

  // Delete notification (User self-delete)
  deleteNotification: async (notificationId: number) => {
    const { data } = await api.delete(`/notifications/${notificationId}`);
    return data;
  },

  // =========================
  // ADMIN ENDPOINTS
  // =========================

  // Admin: Get all notifications with filters
  adminGetAllNotifications: async (params?: {
    userId?: number;
    type?: string;
    isRead?: boolean;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    skip?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.userId != null) query.append("userId", String(params.userId));
    if (params?.type) query.append("type", params.type);
    if (params?.isRead != null) query.append("isRead", String(params.isRead));
    if (params?.dateFrom) query.append("dateFrom", params.dateFrom);
    if (params?.dateTo) query.append("dateTo", params.dateTo);
    if (params?.limit != null) query.append("limit", String(params.limit));
    if (params?.skip != null) query.append("skip", String(params.skip));

    const qs = query.toString();
    const { data } = await api.get(`/notifications${qs ? `?${qs}` : ""}`);
    return data;
  },

  // Admin: Get notifications for a specific user
  adminGetUserNotifications: async (
    userId: number,
    params?: {
      unreadOnly?: boolean;
      limit?: number;
      skip?: number;
    }
  ) => {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.append("unreadOnly", "true");
    if (params?.limit != null) query.append("limit", String(params.limit));
    if (params?.skip != null) query.append("skip", String(params.skip));

    const qs = query.toString();
    const { data } = await api.get(`/notifications/user/${userId}${qs ? `?${qs}` : ""}`);
    return data;
  },

  // Admin: Create notification for a user
  adminCreateNotification: async (payload: {
    userId: number;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
  }) => {
    const { data } = await api.post("/notifications", payload);
    return data;
  },

  // Admin: Send to all users
  adminSendAllUsers: async (payload: {
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
  }) => {
    const { data } = await api.post("/notifications/all", payload);
    return data;
  },

  // Admin: Send to privileged users
  adminSendPrivileged: async (payload: {
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: number;
    actionUrl?: string;
  }) => {
    const { data } = await api.post("/notifications/privileged", payload);
    return data;
  },

  // Admin: Delete specific user's notification
  adminDeleteUserNotification: async (userId: number, notificationId: number) => {
    const { data } = await api.delete(`/notifications/user/${userId}/notification/${notificationId}`);
    return data;
  },

  // =========================
  // ADMIN DELETE WORKFLOWS
  // =========================

  // 1. Force delete any notification (ignores owner)
  adminForceDelete: async (notificationId: number) => {
    const { data } = await api.delete(`/notifications/force/${notificationId}`);
    return data;
  },

  // 2. Bulk delete multiple notifications
  adminBulkDelete: async (notificationIds: number[]) => {
    const { data } = await api.post("/notifications/bulk-delete", { ids: notificationIds });
    return data;
  },

  // 3. Prune old notifications
  adminPruneNotifications: async (daysOld: number = 30, onlyRead: boolean = false) => {
    const { data } = await api.post("/notifications/prune", { daysOld, onlyRead });
    return data;
  },

  // 4. Clear specific user's inbox (all notifications)
  adminClearUserInbox: async (userId: number) => {
    const { data } = await api.delete(`/notifications/users/${userId}/all`);
    return data;
  },

  // 5. Delete all notifications of a specific type
  adminDeleteByType: async (type: string) => {
    const { data } = await api.delete(`/notifications/type/${type}`);
    return data;
  },

  // 6. Truncate - delete ALL notifications (nuclear option)
  adminTruncate: async () => {
    const { data } = await api.delete(`/notifications/truncate`);
    return data;
  },
};
