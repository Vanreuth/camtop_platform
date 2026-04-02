import { defineConfig } from "@prisma/config";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  schema: "./prisma/schema.prisma",
});
