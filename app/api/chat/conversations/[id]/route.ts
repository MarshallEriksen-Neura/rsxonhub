import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  deleteConversation,
  getConversation,
  getConversationMessages,
} from "@/lib/chat/conversations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const conversation = await getConversation(id);
  if (!conversation) {
    return NextResponse.json({ error: "CONVERSATION_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title ?? "新对话",
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    messages: await getConversationMessages(id),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const id = parseId((await context.params).id);
  if (!id) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  await deleteConversation(id);
  return NextResponse.json({ ok: true });
}

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
