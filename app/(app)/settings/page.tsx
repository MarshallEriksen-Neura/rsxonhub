import { SettingsWorkspace } from "@/components/settings/settings-workspace";
import { getPublicAIConfigSnapshot } from "@/lib/ai/config";

/**
 * /settings — 设置。左侧分区导航 + 右侧配置面板。
 * 当前可配置:订阅源管理、分类管理、AI 配置、账号。
 * header/面包屑由 (app)/layout 统一渲染;工作区交互在 SettingsWorkspace(客户端)。
 * AI 配置由服务端读取 DB 快照后传给客户端工作区。
 */
export default async function SettingsPage() {
  const aiConfig = await getPublicAIConfigSnapshot();

  return <SettingsWorkspace aiConfig={aiConfig} />;
}
