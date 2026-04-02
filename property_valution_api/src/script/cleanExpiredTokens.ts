import { prisma } from "../db/prisma";

/**
 * Clean up expired and revoked refresh tokens
 * Run this periodically (e.g., daily via cron job)
 */
export async function cleanExpiredTokens() {
  try {
    const now = new Date();
    
    // Delete tokens that are either:
    // 1. Expired
    // 2. Revoked more than 7 days ago (keep recent ones for audit)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { 
            revokedAt: { 
              lt: sevenDaysAgo,
              not: null 
            } 
          },
        ],
      },
    });

    console.log(`✅ Cleaned up ${result.count} expired/old refresh tokens`);
    return result.count;
  } catch (error) {
    console.error("❌ Error cleaning expired tokens:", error);
    throw error;
  }
}

// If run directly
if (require.main === module) {
  cleanExpiredTokens()
    .then((count) => {
      console.log(`Cleanup complete. Removed ${count} tokens.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Cleanup failed:", error);
      process.exit(1);
    });
}
