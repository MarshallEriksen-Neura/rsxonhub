import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { AppTopbar } from "@/components/app-shell/app-topbar";
import { PageBreadcrumb } from "@/components/app-shell/page-breadcrumb";
import { SidebarCollapseProvider } from "@/components/app-shell/sidebar-collapse-context";

/**
 * (app) 路由组共享布局 = AppShell。登录后所有页共享:
 * 左侧主导航 + 顶栏(header)+ 面包屑,内容区由各页 children 填充。
 * 顶栏标题与面包屑均由当前路由自动推导(见 components/app-shell/nav.ts),
 * 各页不再各自渲染 header。
 * 认证在 proxy.ts(middleware)统一拦截,这里直接假定已登录。
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SidebarCollapseProvider>
      <div className="flex h-dvh overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <PageBreadcrumb />
          {children}
        </div>
      </div>
    </SidebarCollapseProvider>
  );
}
