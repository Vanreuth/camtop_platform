import config from "./config";
import { app } from "./app";
import { prisma } from "./db/prisma";
import { logger } from "./config/logger";
import { cacheService } from "./services/cache/cache.service";
import "./events/listeners/valuationListeners";
import "./events/listeners/indicativeValuationListeners";
// do NOT import propertyEventListeners again here

const PORT = config.server.port;

const server = app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env: config.server.nodeEnv,
    },
    "🚀 Server started"
  );
});

let isShuttingDown = false;

const sockets = new Set<any>();

server.on("connection", (socket) => {
  sockets.add(socket);

  socket.on("close", () => {
    sockets.delete(socket);
  });
});

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn({ signal }, "🛑 Shutdown signal received");

  const forceTimeout = setTimeout(() => {
    logger.fatal("⏰ Forced shutdown after timeout");
    for (const socket of sockets) {
      try {
        socket.destroy();
      } catch {}
    }
    process.exit(1);
  }, 10_000);

  try {
    // Stop new incoming connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    logger.info("🧹 HTTP server closed");

    // Close DB
    await prisma.$disconnect();
    logger.info("🗄️ Prisma disconnected");

    await cacheService.disconnect();
    logger.info("🧰 Cache disconnected");

    clearTimeout(forceTimeout);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "❌ Error during shutdown");
    clearTimeout(forceTimeout);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "💥 Uncaught exception");
  void shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "💥 Unhandled promise rejection");
  void shutdown("unhandledRejection");
});
