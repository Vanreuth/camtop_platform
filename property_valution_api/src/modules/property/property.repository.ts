import type { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";

export class PropertyRepository {
	create(args: Prisma.PropertyCreateArgs) {
		return prisma.property.create(args);
	}

	findMany(args: Prisma.PropertyFindManyArgs) {
		return prisma.property.findMany(args);
	}

	count(args: Prisma.PropertyCountArgs) {
		return prisma.property.count(args);
	}

	findFirst(args: Prisma.PropertyFindFirstArgs) {
		return prisma.property.findFirst(args);
	}

	update(args: Prisma.PropertyUpdateArgs) {
		return prisma.property.update(args);
	}

	updateMany(args: Prisma.PropertyUpdateManyArgs) {
		return prisma.property.updateMany(args);
	}

	updateTransaction(args: Prisma.TransactionUpdateArgs) {
		return prisma.transaction.update(args);
	}

	createTransaction(args: Prisma.TransactionCreateArgs) {
		return prisma.transaction.create(args);
	}

	deleteTransaction(args: Prisma.TransactionDeleteArgs) {
		return prisma.transaction.delete(args);
	}
}

