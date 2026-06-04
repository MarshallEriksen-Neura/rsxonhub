import { SignOutButton } from "@/components/auth/sign-out-button";
import { mockFeeds } from "@/lib/mock/feed";

/**
 * /settings — 设置。单用户,项少。
 * 分区:订阅管理 / AI 配置 / 抓取状态 / 账号。
 * header/面包屑由 (app)/layout 统一渲染。
 * 占位:静态展示,后端接入后填真实 env / feeds / usage_logs。
 */
export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-body-md-medium">订阅管理</h2>
            <div className="card-base flex flex-col divide-y divide-border !p-0">
              {mockFeeds.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 px-4 py-3"
                >
                  <span className="truncate text-body-sm">{f.title}</span>
                  <span className="shrink-0 text-caption text-muted-foreground">
                    {f.folder ?? "未分组"} · 每 1h
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-body-md-medium">AI 配置</h2>
            <div className="card-base flex flex-col gap-2 text-body-sm">
              <Row label="Chat 模型" value="来自 env · CHAT_MODEL" />
              <Row label="Embedding 模型" value="nvidia/llama-nemotron-embed-1b-v2" />
              <Row label="向量维度" value="已锁定 2048 维(只读)" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-body-md-medium">抓取状态</h2>
            <div className="card-base flex flex-col gap-2 text-body-sm">
              <Row label="上次抓取" value="—(占位)" />
              <Row label="累计用量" value="来自 usage_logs(占位)" />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-body-md-medium">账号</h2>
            <div className="card-base flex items-center justify-between">
              <span className="text-body-sm text-muted-foreground">退出当前登录</span>
              <SignOutButton />
            </div>
          </section>
        </div>
      </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-foreground">{value}</span>
    </div>
  );
}
