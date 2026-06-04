import { ChatPanel } from "@/components/chat/chat-panel";

/**
 * /chat — RAG 问答(AI 核心差异点)。
 * 类 ChatGPT:消息流 + 底部输入。每条 AI 回答下方挂「来源引用」卡片。
 * header/面包屑由 (app)/layout 统一渲染。
 * 当前为静态占位,后端接 article_chunks 向量检索 + 引用回溯后变为真实流式。
 */
export default function ChatPage() {
  return <ChatPanel />;
}
