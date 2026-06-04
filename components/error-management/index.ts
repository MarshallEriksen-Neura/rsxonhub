/**
 * 全局异常状态管理组件导出
 * 
 * 包含：
 * - GlobalError: Next.js 全局错误边界（app/global-error.tsx）
 * - ErrorBoundary: 局部错误边界组件
 * - EmptyState: 通用空状态封装
 */

export { default as GlobalError } from "@/app/global-error";
export { FullPageError } from "@/components/error-management/full-page-error";
export { ErrorBoundary, useErrorHandler } from "@/components/retroui/ErrorBoundary";
export { EmptyState, EmptyStates, type EmptyStateType } from "@/components/retroui/EmptyState";
