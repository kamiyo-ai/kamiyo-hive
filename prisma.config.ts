import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: "prisma/schema.prisma",
  datasource: {
    async url() {
      return process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";
    },
  },
});
