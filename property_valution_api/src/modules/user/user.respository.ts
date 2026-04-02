import { prisma } from "../../db/prisma";

export class UserRepository {
	create(data: any) {
		return prisma.user.create(data);
	}

	update(params: any) {
		return prisma.user.update(params);
	}

	findUnique(params: any) {
		return prisma.user.findUnique(params);
	}

	findFirst(params: any) {
		return prisma.user.findFirst(params);
	}

	findMany(params: any) {
		return prisma.user.findMany(params);
	}

	count(where: any) {
		return prisma.user.count({ where });
	}

	findRoleById(roleId: number) {
		return prisma.role.findUnique({ where: { id: roleId } });
	}

	// Statistics methods
	async getUserStatistics(filters?: {
		startDate?: Date;
		endDate?: Date;
		roleId?: number;
	}) {
		const where: any = {};

		if (filters?.startDate || filters?.endDate) {
			where.createdAt = {};
			if (filters.startDate) where.createdAt.gte = filters.startDate;
			if (filters.endDate) where.createdAt.lte = filters.endDate;
		}

		if (filters?.roleId) {
			where.roles = { some: { roleId: filters.roleId } };
		}

		// Total users
		const totalUsers = await prisma.user.count({ where });

		// Active vs Inactive users
		const activeUsers = await prisma.user.count({
			where: { ...where, status: "ACTIVE" },
		});
		const inactiveUsers = await prisma.user.count({
			where: { ...where, status: "DISABLED" },
		});
		const suspendedUsers = await prisma.user.count({
			where: { ...where, status: "SUSPENDED" },
		});

		// Users by role
		const usersByRole = await prisma.userRole.groupBy({
			by: ["roleId"],
			_count: { userId: true },
		});

		// Get role names
		const roles = await prisma.role.findMany({
			select: { id: true, roleName: true, roleCode: true },
		});

		const roleMap = new Map(roles.map((r) => [r.id, r]));
		const byRole = usersByRole.map((item) => ({
			roleId: item.roleId,
			roleName: roleMap.get(item.roleId)?.roleName || "Unknown",
			roleCode: roleMap.get(item.roleId)?.roleCode || "unknown",
			count: item._count.userId,
		}));

		// Recent users (last 30 days)
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
		const recentUsers = await prisma.user.count({
			where: { createdAt: { gte: thirtyDaysAgo } },
		});

		// Users created this month
		const startOfMonth = new Date();
		startOfMonth.setDate(1);
		startOfMonth.setHours(0, 0, 0, 0);
		const usersThisMonth = await prisma.user.count({
			where: { createdAt: { gte: startOfMonth } },
		});

		// Monthly registration trends (last 6 months)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const monthlyTrends = await prisma.$queryRaw<
			{ month: string; count: bigint }[]
		>`
			SELECT 
				TO_CHAR("createdAt", 'YYYY-MM') as month,
				COUNT(*)::bigint as count
			FROM "users"
			WHERE "createdAt" >= ${sixMonthsAgo}
			GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
			ORDER BY month ASC
		`;

		// Users with valuations (valuers)
		const usersWithValuations = await prisma.user.count({
			where: {
				valuationsCreated: { some: {} },
			},
		});

		// Top valuers by valuation count
		const topValuers = await prisma.propertyValuation.groupBy({
			by: ["valuerId"],
			_count: { valuationId: true },
			_avg: { marketValue: true },
			where: { valuerId: { not: null } },
			orderBy: { _count: { valuationId: "desc" } },
			take: 10,
		});

		// Get valuer details
		const valuerIds = topValuers
			.map((v) => v.valuerId)
			.filter((id): id is number => id !== null);
		const valuers = await prisma.user.findMany({
			where: { id: { in: valuerIds } },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				username: true,
				profilePicture: true,
			},
		});

		const valuerMap = new Map(valuers.map((v) => [v.id, v]));
		const topValuersWithDetails = topValuers.map((item) => ({
			valuerId: item.valuerId,
			valuerName: item.valuerId
				? `${valuerMap.get(item.valuerId)?.firstName || ""} ${valuerMap.get(item.valuerId)?.lastName || ""}`.trim() ||
					valuerMap.get(item.valuerId)?.username ||
					"Unknown"
				: "Unassigned",
			profilePicture: item.valuerId
				? valuerMap.get(item.valuerId)?.profilePicture
				: null,
			valuationCount: item._count.valuationId,
			avgMarketValue: item._avg.marketValue,
		}));

		return {
			overview: {
				totalUsers,
				activeUsers,
				inactiveUsers,
				suspendedUsers,
				recentUsers,
				usersThisMonth,
				usersWithValuations,
			},
			byStatus: {
				ACTIVE: activeUsers,
				INACTIVE: inactiveUsers,
				SUSPENDED: suspendedUsers,
			},
			byRole,
			topValuers: topValuersWithDetails,
			trends: {
				monthly: monthlyTrends.map((item) => ({
					month: item.month,
					count: Number(item.count),
				})),
			},
		};
	}
}

