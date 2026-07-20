import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomCreateSchema } from "@/lib/validation";
import { randomBytes } from "crypto";

function generateRoomCode() {
  // Short, human-shareable room code, e.g. "A1B2C3"
  return randomBytes(4).toString("hex").toUpperCase().slice(0, 6);
}

// GET: list rooms the current user is a member of
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.roomMember.findMany({
    where: { userId: session.user.id },
    include: {
      room: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const rooms = memberships.map((m) => ({
    id: m.room.id,
    name: m.room.name,
    code: m.room.code,
    memberCount: m.room._count.members,
  }));

  return NextResponse.json({ rooms });
}

// POST: create a new room. Creator is automatically added as a member.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = roomCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  // Ensure a unique room code, retry a few times on collision
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) break;
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: {
      name: parsed.data.name,
      code,
      members: {
        create: { userId: session.user.id },
      },
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}
