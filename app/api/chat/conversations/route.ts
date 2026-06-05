import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createConversation,
  listConversations,
} from "@/lib/chat/conversations";
import { parseConversationCursor } from "@/lib/chat/conversation-cursor";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = numberParam(searchParams.get("limit")) ?? 20;
  const cursor = parseConversationCursor(searchParams.get("cursor"));
  const search = searchParams.get("search");

  return NextResponse.json(
    await listConversations({ limit, cursor, search }),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { title?: string };
  const conversation = await createConversation({ title: body.title });

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      title: conversation.title ?? "新对话",
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
  });
}

function numberParam(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
