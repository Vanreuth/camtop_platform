import {z} from "zod";
import {NotificationType} from "@prisma/client";

export const NotificationTypeSchema = z.nativeEnum(NotificationType);

export const CreateNotificationSchema = z.object({
  userId: z.number().int().positive(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  entityType: z.string().max(100).optional(),
  entityId: z.number().int().positive().optional(),
  actionUrl: z.string().max(500).optional(),
});

export const CreateManyNotificationsSchema = z.object({
  notifications: z.array(CreateNotificationSchema).min(1).max(500),
});

export const ListNotificationsQuerySchema = z.object({
  unreadOnly: z
    .string()
    .optional()
    .transform(v => v === "true"),
  limit: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(100).optional()),
  skip: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(0).max(10000).optional()),
});

export const NotificationIdParamSchema = z.object({
  id: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().positive()),
});
export const UserIdParamSchema = z.object({
  userId: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().positive()),
});

export const adminListAllNotificationsQuerySchema = z.object({
  userId: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : undefined))
    .pipe(z.number().int().positive().optional()),

  type: NotificationTypeSchema.optional(),

  isRead: z
    .string()
    .optional()
    .transform(v => (v === undefined ? undefined : v === "true"))
    .pipe(z.boolean().optional()),

  dateFrom: z
    .string()
    .optional()
    .transform(v => (v ? new Date(v) : undefined))
    .refine(d => d === undefined || !Number.isNaN(d.getTime()), "Invalid dateFrom"),

  dateTo: z
    .string()
    .optional()
    .transform(v => (v ? new Date(v) : undefined))
    .refine(d => d === undefined || !Number.isNaN(d.getTime()), "Invalid dateTo"),

  limit: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(100)),

  skip: z
    .string()
    .optional()
    .transform(v => (v ? Number(v) : 0))
    .pipe(z.number().int().min(0).max(100000)),
});

export const adminSendToUserBodySchema = z.object({
  userId: z.number().int().positive(),
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  entityType: z.string().max(100).optional(),
  entityId: z.number().int().positive().optional(),
  actionUrl: z.string().max(500).optional(),
});

export const adminSendToAllUsersBodySchema = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  entityType: z.string().optional(),
  entityId: z.coerce.number().int().positive().optional(),
  actionUrl: z.string().optional(),
});


export const adminSendToPrivilegedUsersBodySchema = z.object({
  type: NotificationTypeSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  entityType: z.string().max(100).optional(),
  entityId: z.number().int().positive().optional(),
  actionUrl: z.string().max(500).optional(),
});

export const adminUserIdParamSchema = z.object({
  userId: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().positive()),
});

export const adminDeleteParamSchema = z.object({
  userId: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().positive()),
  id: z
    .string()
    .transform(v => Number(v))
    .pipe(z.number().int().positive()),
});

export const adminBulkDeleteBodySchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "At least one ID is required"),
});

// ✅ FIX: Remove the outer "body" wrapper
export const adminPruneBodySchema = z.object({
  daysOld: z.number().int().min(1).default(30),
  onlyRead: z.boolean().optional(),
});

// ✅ FIX: Remove the outer "params" wrapper
export const adminForceDeleteParamSchema = z.object({
  id: z.string().transform((val) => parseInt(val, 10)).refine((val) => !isNaN(val), "Invalid ID"),
});


export const adminTypeParamSchema = z.object({
  params: z.object({
    type: z.nativeEnum(NotificationType, {
    }),
  }),
});



