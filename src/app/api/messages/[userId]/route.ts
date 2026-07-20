import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { messageSchema } from "@/lib/validation";

// GET: fetch the full DM conversation between the current user and `userId`
export async function GET(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const otherUserId = params.userId;

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: session.user.id, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: session.user.id },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  return NextResponse.json({ messages });
}

// POST: send a direct message to `userId`
export async function POST(
  req: Request,
  { params }: { params: { userId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const otherUserId = params.userId;

  if (otherUserId === session.user.id) {
    return NextResponse.json({ error: "You cannot message yourself." }, { status: 400 });
  }

  const recipient = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found." }, { status: 404 });
  }

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 }
    );
  }

  const message = await prisma.message.create({
    data: {
      content: parsed.data.content,
      senderId: session.user.id,
      receiverId: otherUserId,
    },
  });

  return NextResponse.json({ message }, { status: 201 });
}
