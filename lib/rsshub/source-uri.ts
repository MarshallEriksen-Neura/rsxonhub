import { env } from "@/lib/env";
import {
  resolveFeedSource as resolveFeedSourceCore,
  resolveRsshubSource as resolveRsshubSourceCore,
} from "@/lib/rsshub/source-uri-core";

export type {
  FeedSource,
  HttpSource,
  RsshubSource,
} from "@/lib/rsshub/source-uri-core";
export { SourceUriError } from "@/lib/rsshub/source-uri-core";

export function resolveFeedSource(input: string, baseUrl = env.RSSHUB_BASE_URL) {
  return resolveFeedSourceCore(input, baseUrl);
}

export function resolveRsshubSource(uri: string, baseUrl = env.RSSHUB_BASE_URL) {
  return resolveRsshubSourceCore(uri, baseUrl);
}
