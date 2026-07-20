import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

async function assertMembership(userId: string, roomId: string) {
  const membership = await prisma.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return !!membership;
}

// GET: fetch message history for a room (only if the user is a member)
export async function GET(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMembership(session.user.id, params.roomId);
  if (!isMember) {
    return NextResponse.json({ error: "You are not a member of this room." }, { status: 403 });
  }

  const messages = await prisma.roomMessage.findMany({
    where: { roomId: params.roomId },
    include: { sender: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ messages });
}

// POST: send a message to a room (only if the user is a member)
export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isMember = await assertMembership(session.user.id, params.roomId);
  if (!isMember) {
    return NextResponse.json({ error: "You are not a member of this room." }, { status: 403 });
  }

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 }
    );
  }

  const message = await prisma.roomMessage.create({
    data: {
      content: parsed.data.content,
      roomId: params.roomId,
      senderId: session.user.id,
    },
    include: { sender: { select: { id: true, username: true } } },
  });

  return NextResponse.json({ message }, { status: 201 });
}
