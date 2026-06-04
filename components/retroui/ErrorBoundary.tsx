"use client";

import { Component, ErrorInfo, ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { Button } from "@/components/retroui/Button";
import { Alert } from "@/components/retroui/Alert";
import { TriangleAlert } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.props.resetKeys) {
      const hasChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      
      if (hasChanged && this.state.hasError) {
        this.setState({
          hasError: false,
          error: null,
        });
      }
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4">
          <Alert status="error" className="mb-4">
            <Alert.Title className="flex items-center gap-2 mb-2">
              <TriangleAlert className="w-5 h-5" />
              组件加载失败
            </Alert.Title>
            <Alert.Description>
              {this.state.error?.message || "未知错误"}
            </Alert.Description>
          </Alert>

          <EmptyState
            type="default"
            customTitle="出现错误"
            customDescription={
              this.state.error?.message || "组件渲染时发生错误，请重试"
            }
            showAction
            actionText="重新加载"
            onAction={this.handleReset}
            minHeight="min-h-[200px]"
          />
        </div>
      );
    }

    return this.props.children;
  }
}

// 便捷 Hook 用法（用于函数组件）
export function useErrorHandler() {
  const handleError = (error: Error) => {
    throw error;
  };
  
  return handleError;
}
