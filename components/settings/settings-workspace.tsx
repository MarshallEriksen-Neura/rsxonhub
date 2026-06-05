"use client";

import { useState } from "react";
import { Rss, FolderTree, Sparkles, UserCircle, Target, Activity } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { FeedsSection } from "./feeds-section";
import { CategoriesSection } from "./categories-section";
import { AISection } from "./ai-section";
import { AccountSection } from "./account-section";
import { InterestSection } from "./interest-section";
import { ObservabilitySection } from "./observability-section";
import type { PublicAIConfigSnapshot } from "@/lib/ai/config";
import type { AIModelPresetSnapshot } from "@/lib/ai/model-presets";
import type { ActiveInterestProfile } from "@/lib/interests/profile";
import type { getSettingsObservabilitySnapshot } from "@/app/(app)/settings/actions";

/**
 * /settings 工作区。左侧分区导航 + 右侧配置面板(双栏,asymmetric)。
 * 当前需要配置的两块:订阅源管理、分类管理 + AI 配置;账号收尾。
 *
 * 选中态用 motion 共享元素(layoutId)在导航项间滑动,
 * 面板切换走 fade/slide,无外发光、无紫色光晕 —— 保持项目 Notion 调性。
 * 移动端导航塌成顶部横向 chips。
 */
type SectionId = "feeds" | "categories" | "interest" | "ai" | "observability" | "account";

const SECTIONS: {
  id: SectionId;
  label: string;
  desc: string;
  icon: typeof Rss;
}[] = [
  { id: "feeds", label: "订阅源管理", desc: "增删订阅、改名归类", icon: Rss },
  { id: "categories", label: "分类管理", desc: "重命名 / 合并 / 删除", icon: FolderTree },
  { id: "interest", label: "兴趣画像", desc: "日报与摘要候选", icon: Target },
  { id: "ai", label: "AI 配置", desc: "对话与向量模型", icon: Sparkles },
  { id: "observability", label: "运行观测", desc: "抓取与用量", icon: Activity },
  { id: "account", label: "账号", desc: "登录与退出", icon: UserCircle },
];

export function SettingsWorkspace({
  aiConfig,
  aiModelPresets,
  interestProfile,
  observability,
}: {
  aiConfig: PublicAIConfigSnapshot;
  aiModelPresets: AIModelPresetSnapshot;
  interestProfile: ActiveInterestProfile | null;
  observability: Awaited<ReturnType<typeof getSettingsObservabilitySnapshot>>;
}) {
  const [active, setActive] = useState<SectionId>("feeds");

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto w-full max-w-7xl grid grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[14rem_minmax(0,1fr)] md:px-6 md:py-8 lg:px-8 lg:py-10">
        {/* 左:分区导航 */}
        <nav className="flex flex-col gap-1 md:sticky md:top-12 md:self-start">
          <h1 className="px-3 pb-3 text-heading-5 text-ink">设置</h1>
          {/* 移动端横向滚动,桌面端竖排 */}
          <div className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {SECTIONS.map((s) => {
              const isActive = active === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200",
                    "active:scale-[0.98]",
                    isActive ? "text-primary" : "text-charcoal hover:bg-surface hover:text-ink",
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="settings-nav-active"
                      className="absolute inset-0 -z-[1] rounded-lg bg-primary/8 ring-1 ring-primary/15"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon
                    size={17}
                    aria-hidden
                    className={cn(
                      "shrink-0 transition-opacity",
                      isActive ? "opacity-100" : "opacity-65 group-hover:opacity-90",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-body-sm-medium leading-tight">{s.label}</span>
                    <span className="hidden text-micro font-normal text-steel md:block">
                      {s.desc}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* 右:配置面板 */}
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="min-w-0"
        >
          {active === "feeds" && <FeedsSection />}
          {active === "categories" && <CategoriesSection />}
          {active === "interest" && <InterestSection initialProfile={interestProfile} />}
          {active === "ai" && (
            <AISection
              initialConfig={aiConfig}
              initialModelPresets={aiModelPresets}
              latestRebuild={observability.latestRebuild}
            />
          )}
          {active === "observability" && <ObservabilitySection snapshot={observability} />}
          {active === "account" && <AccountSection />}
        </motion.div>
      </div>
    </div>
  );
}
