import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanupOldTokens() {
  console.log("Starting token cleanup...");

  // Set the cutoff date to 1 days ago
  const thirtyDaysAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  // Delete tokens that were revoked OR expired more than 1 days ago
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { revokedAt: { not: null, lt: thirtyDaysAgo } },
        { expiresAt: { lt: thirtyDaysAgo } },
      ],
    },
  });

  console.log(`Cleanup finished. Deleted ${count} old tokens.`);
}

// Execute the function and handle errors
cleanupOldTokens()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
