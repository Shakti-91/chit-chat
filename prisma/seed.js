// Optional: creates a couple of demo users so you can test DMs right away.
// Run with: npm run seed
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const demoUsers = [
    { username: "alicesmith", password: "password123" },
    { username: "bobjohnson", password: "password123" },
  ];

  for (const u of demoUsers) {
    const hashed = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: { username: u.username, password: hashed },
    });
    console.log(`Seeded user: ${u.username} / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
