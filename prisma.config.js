import "dotenv/config";

/** @type {import('@prisma/config').PrismaConfig} */
const config = {
  // This tells Prisma where your schema file is
  schema: "./prisma/schema.prisma",
};

export default config;
