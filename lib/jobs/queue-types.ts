import { JOB_NAMES } from "@/lib/jobs/names";

export type QueueAction = "cancel-waiting" | "retry-failed" | "delete-completed";

export type QueueSnapshot = {
  name: string;
  created: number;
  retry: number;
  active: number;
  completed: number;
  failed: number;
  cancelled: number;
  expired: number;
  total: number;
  waiting: number;
  oldestWaitingAt: string | null;
  newestJobAt: string | null;
  lastCompletedAt: string | null;
};

export const KNOWN_QUEUES = Object.values(JOB_NAMES);

export const QUEUE_LABELS: Record<string, string> = {
  [JOB_NAMES.feedFetchDue]: "扫描到期订阅源",
  [JOB_NAMES.feedFetchOne]: "抓取单个订阅源",
  [JOB_NAMES.articleEmbed]: "文章向量索引",
  [JOB_NAMES.digestPrepareDaily]: "每日精选准备",
  [JOB_NAMES.digestGenerateDaily]: "每日精选生成",
};

export function isKnownQueue(name: string): name is (typeof KNOWN_QUEUES)[number] {
  return KNOWN_QUEUES.includes(name as (typeof KNOWN_QUEUES)[number]);
}
