import { ChatPanel } from "@/components/chat/chat-panel";
import { getChatModelSelectionSnapshot } from "@/lib/ai/chat-model-directory";

/**
 * /chat — RAG 问答(AI 核心差异点)。
 * 类 ChatGPT:消息流 + 底部输入。每条 AI 回答下方挂「来源引用」卡片。
 * header/面包屑由 (app)/layout 统一渲染。
 */
export default async function ChatPage() {
  const modelSelection = await getChatModelSelectionSnapshot();

  return <ChatPanel modelSelection={modelSelection} />;
}
