import { ErrorPage } from "@components/UI/ErrorPage.tsx";
import Footer from "@components/UI/Footer.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import { cn } from "@core/utils/cn.ts";
import {
  type LucideIcon,
  SidebarCloseIcon,
  SidebarOpenIcon,
} from "lucide-react";
import { ErrorBoundary } from "react-error-boundary";

export interface PageLayoutProps {
  label: string;
  noPadding?: boolean;
  children: React.ReactNode;
  className?: string;
  actions?: {
    icon: LucideIcon;
    iconClasses?: string;
    onClick: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }[];
}

export const PageLayout = ({
  label,
  noPadding,
  actions,
  className,
  children,
}: PageLayoutProps) => {
  const { showSidebar, setShowSidebar } = useAppStore();

  return (
    <ErrorBoundary FallbackComponent={ErrorPage}>
      <div className="relative flex h-full w-full flex-col">
        <div className="flex h-14 shrink-0 border-b-[0.5px]  border-slate-300 dark:border-slate-700 md:h-16 md:px-4">
          <button
            type="button"
            className="pl-4 transition-all hover:text-accent"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? (
              <SidebarCloseIcon size={24} />
            ) : (
              <SidebarOpenIcon size={24} />
            )}
          </button>
          <div className="flex flex-1 items-center justify-between px-4 md:px-0">
            <div className="flex w-full items-center">
              <span className="w-full text-lg font-medium">{label}</span>
              <div className="flex justify-end space-x-4">
                {actions?.map((action) => (
                  <button
                    key={action.icon.displayName}
                    type="button"
                    disabled={action?.disabled}
                    className="transition-all hover:text-accent"
                    onClick={action.onClick}
                  >
                    {action?.isLoading ? (
                      <Spinner />
                    ) : (
                      <action.icon
                        className={action.iconClasses}
                        aria-disabled={action.disabled}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "flex h-full w-full flex-col overflow-y-auto",
            !noPadding && "pl-3 pr-3 ",
            className
          )}
        >
          {children}
          <Footer />
        </div>
      </div>
    </ErrorBoundary>
  );
};
