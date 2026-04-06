import net from "node:net";
import tls from "node:tls";
import { URL } from "node:url";
import { logger } from "../../config/logger";

type RedisPrimitive = string | number | null;
type RedisValue = RedisPrimitive | RedisValue[];

type PendingCommand = {
  resolve: (value: RedisValue) => void;
  reject: (error: Error) => void;
};

type ParsedResult = {
  value: RedisValue;
  nextOffset: number;
};

type RedisConnectionOptions = {
  url: string;
  connectTimeoutMs: number;
};

const CRLF = "\r\n";

class RedisCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisCommandError";
  }
}

const encodeCommand = (args: Array<string | number>) => {
  const parts = [`*${args.length}${CRLF}`];
  for (const arg of args) {
    const value = String(arg);
    parts.push(`$${Buffer.byteLength(value)}${CRLF}${value}${CRLF}`);
  }
  return Buffer.from(parts.join(""), "utf8");
};

const readLine = (buffer: Buffer, offset: number) => {
  const end = buffer.indexOf(CRLF, offset);
  if (end === -1) return null;

  return {
    line: buffer.toString("utf8", offset, end),
    nextOffset: end + 2,
  };
};

const parseRespValue = (buffer: Buffer, offset = 0): ParsedResult | null => {
  if (offset >= buffer.length) return null;

  const prefix = String.fromCharCode(buffer[offset]);
  const header = readLine(buffer, offset + 1);
  if (!header) return null;

  switch (prefix) {
    case "+":
      return {
        value: header.line,
        nextOffset: header.nextOffset,
      };
    case "-":
      throw new RedisCommandError(header.line);
    case ":":
      return {
        value: Number(header.line),
        nextOffset: header.nextOffset,
      };
    case "$": {
      const length = Number(header.line);
      if (length === -1) {
        return {
          value: null,
          nextOffset: header.nextOffset,
        };
      }

      const endOffset = header.nextOffset + length;
      if (buffer.length < endOffset + 2) return null;

      return {
        value: buffer.toString("utf8", header.nextOffset, endOffset),
        nextOffset: endOffset + 2,
      };
    }
    case "*": {
      const length = Number(header.line);
      if (length === -1) {
        return {
          value: null,
          nextOffset: header.nextOffset,
        };
      }

      const items: RedisValue[] = [];
      let nextOffset = header.nextOffset;

      for (let i = 0; i < length; i += 1) {
        const parsed = parseRespValue(buffer, nextOffset);
        if (!parsed) return null;
        items.push(parsed.value);
        nextOffset = parsed.nextOffset;
      }

      return {
        value: items,
        nextOffset,
      };
    }
    default:
      throw new RedisCommandError(`Unsupported RESP prefix: ${prefix}`);
  }
};

export class RedisClient {
  private readonly options: RedisConnectionOptions;

  private socket: net.Socket | tls.TLSSocket | null = null;

  private pendingCommands: PendingCommand[] = [];

  private responseBuffer = Buffer.alloc(0);

  private connectPromise: Promise<boolean> | null = null;

  private isReady = false;

  private lastWarningAt = 0;

  constructor(options: RedisConnectionOptions) {
    this.options = options;
  }

  private logWarning(message: string, error?: unknown) {
    const now = Date.now();
    if (now - this.lastWarningAt < 60_000) return;
    this.lastWarningAt = now;
    logger.warn({ err: error }, message);
  }

  private parseUrl() {
    const redisUrl = new URL(this.options.url);
    const dbSegment = redisUrl.pathname.replace("/", "").trim();

    return {
      protocol: redisUrl.protocol,
      host: redisUrl.hostname,
      port: Number(redisUrl.port || (redisUrl.protocol === "rediss:" ? 6380 : 6379)),
      username: redisUrl.username ? decodeURIComponent(redisUrl.username) : undefined,
      password: redisUrl.password ? decodeURIComponent(redisUrl.password) : undefined,
      database: dbSegment ? Number(dbSegment) : undefined,
    };
  }

  private attachSocket(socket: net.Socket | tls.TLSSocket) {
    socket.on("data", (chunk: Buffer) => {
      this.responseBuffer = Buffer.concat([this.responseBuffer, chunk]);

      while (this.pendingCommands.length > 0) {
        let parsed: ParsedResult | null = null;

        try {
          parsed = parseRespValue(this.responseBuffer);
        } catch (error) {
          const pending = this.pendingCommands.shift();
          if (pending) {
            pending.reject(
              error instanceof Error ? error : new Error("Unknown Redis parse error"),
            );
          }
          this.responseBuffer = Buffer.alloc(0);
          continue;
        }

        if (!parsed) break;

        this.responseBuffer = this.responseBuffer.subarray(parsed.nextOffset);
        const pending = this.pendingCommands.shift();
        pending?.resolve(parsed.value);
      }
    });

    socket.on("error", (error) => {
      this.logWarning("Redis socket error; continuing without cache", error);
    });

    socket.on("close", () => {
      this.isReady = false;
      this.socket = null;

      if (this.pendingCommands.length > 0) {
        const pending = [...this.pendingCommands];
        this.pendingCommands = [];
        for (const item of pending) {
          item.reject(new Error("Redis connection closed"));
        }
      }
    });
  }

  private createSocket() {
    const { protocol, host, port } = this.parseUrl();
    if (protocol === "rediss:") {
      return tls.connect({ host, port, servername: host });
    }
    if (protocol !== "redis:") {
      throw new Error(`Unsupported Redis protocol: ${protocol}`);
    }
    return net.createConnection({ host, port });
  }

  private async sendCommandInternal(args: Array<string | number>) {
    if (!this.socket || !this.isReady) {
      throw new Error("Redis socket is not connected");
    }

    return await new Promise<RedisValue>((resolve, reject) => {
      this.pendingCommands.push({ resolve, reject });
      this.socket!.write(encodeCommand(args), (error) => {
        if (!error) return;
        this.pendingCommands.pop();
        reject(error);
      });
    });
  }

  async connect() {
    if (this.isReady && this.socket && !this.socket.destroyed) {
      return true;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      let socket: net.Socket | tls.TLSSocket;

      try {
        socket = this.createSocket();
      } catch (error) {
        this.logWarning("Redis configuration is invalid; cache disabled", error);
        this.connectPromise = null;
        resolve(false);
        return;
      }

      const finalize = (connected: boolean, error?: unknown) => {
        if (settled) return;
        settled = true;
        this.connectPromise = null;

        if (!connected) {
          this.isReady = false;
          this.socket = null;
          try {
            socket.destroy();
          } catch {}
          this.logWarning("Unable to connect to Redis; serving without cache", error);
        }

        resolve(connected);
      };

      socket.setTimeout(this.options.connectTimeoutMs, () => {
        finalize(false, new Error("Redis connection timed out"));
      });

      this.attachSocket(socket);

      socket.once("connect", async () => {
        socket.setTimeout(0);
        this.socket = socket;
        this.isReady = true;

        try {
          const { username, password, database } = this.parseUrl();

          if (password) {
            const authArgs = username
              ? ["AUTH", username, password]
              : ["AUTH", password];
            await this.sendCommandInternal(authArgs);
          }

          if (database !== undefined && Number.isFinite(database) && database > 0) {
            await this.sendCommandInternal(["SELECT", database]);
          }

          finalize(true);
        } catch (error) {
          finalize(false, error);
        }
      });

      socket.once("error", (error) => {
        finalize(false, error);
      });
    });

    return this.connectPromise;
  }

  async get(key: string) {
    const connected = await this.connect();
    if (!connected) return null;

    const value = await this.sendCommandInternal(["GET", key]);
    if (value == null) return null;
    return String(value);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    const connected = await this.connect();
    if (!connected) return;

    const args: Array<string | number> = ["SET", key, value];
    if (ttlSeconds && ttlSeconds > 0) {
      args.push("EX", ttlSeconds);
    }

    await this.sendCommandInternal(args);
  }

  async del(...keys: string[]) {
    if (!keys.length) return 0;

    const connected = await this.connect();
    if (!connected) return 0;

    const result = await this.sendCommandInternal(["DEL", ...keys]);
    return typeof result === "number" ? result : Number(result ?? 0);
  }

  async incr(key: string) {
    const connected = await this.connect();
    if (!connected) return null;

    const result = await this.sendCommandInternal(["INCR", key]);
    return typeof result === "number" ? result : Number(result ?? 0);
  }

  async disconnect() {
    if (!this.socket) return;

    try {
      await this.sendCommandInternal(["QUIT"]);
    } catch {}

    try {
      this.socket.end();
      this.socket.destroy();
    } catch {}

    this.socket = null;
    this.isReady = false;
  }
}
