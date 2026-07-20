import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { roomJoinSchema } from "@/lib/validation";

// POST: join an existing room using its unique code
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = roomJoinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const room = await prisma.room.findUnique({
    where: { code: parsed.data.code.toUpperCase() },
  });

  if (!room) {
    return NextResponse.json({ error: "Room not found. Check the code." }, { status: 404 });
  }

  const existingMembership = await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId: session.user.id, roomId: room.id } },
  });

  if (existingMembership) {
    return NextResponse.json({ room, alreadyMember: true });
  }

  await prisma.roomMember.create({
    data: { userId: session.user.id, roomId: room.id },
  });

  return NextResponse.json({ room }, { status: 201 });
}
