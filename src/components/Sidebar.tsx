import { SidebarSection } from "@components/UI/Sidebar/SidebarSection.tsx";
import { SidebarButton } from "@components/UI/Sidebar/sidebarButton.tsx";
import { Spinner } from "@components/UI/Spinner.tsx";
import { Subtle } from "@components/UI/Typography/Subtle.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import type { Page } from "@core/stores/deviceStore.ts";
import { useDevice } from "@core/stores/deviceStore.ts";
import { useEffect, useRef } from "react";

import {
  BatteryMediumIcon,
  CpuIcon,
  EditIcon,
  LayersIcon,
  type LucideIcon,
  MapIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { deviceNameParser } from "@app/core/utils/nameParser";

export interface SidebarProps {
  children?: React.ReactNode;
}

export const Sidebar = ({ children }: SidebarProps) => {
  const { hardware, nodes, metadata } = useDevice();
  const myNode = nodes.get(hardware.myNodeNum);
  const myMetadata = metadata.get(0);
  const { activePage, setActivePage, setDialogOpen } = useDevice();
  const { showSidebar, setShowSidebar } = useAppStore();
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node)
      ) {
        setShowSidebar(false);
      }
    };

    if (showSidebar) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSidebar, setShowSidebar]);

  interface NavLink {
    name: string;
    icon: LucideIcon;
    page: Page;
  }

  const pages: NavLink[] = [
    {
      name: "Messages",
      icon: MessageSquareIcon,
      page: "messages",
    },
    {
      name: "Map",
      icon: MapIcon,
      page: "map",
    },
    {
      name: "Config",
      icon: SettingsIcon,
      page: "config",
    },
    {
      name: "Channels",
      icon: LayersIcon,
      page: "channels",
    },
    {
      name: `Nodes (${Math.max(nodes.size - 1, 0)})`,
      icon: UsersIcon,
      page: "nodes",
    },
  ];

  return showSidebar ? (
    <div
      ref={sidebarRef}
      className="min-w-[280px] max-w-min flex-col overflow-y-auto border-r-[0.5px] bg-background-primary border-slate-300 dark:border-slate-400"
    >
      {myNode === undefined ? (
        <div className="flex flex-col items-center justify-center px-8 py-6">
          <Spinner />
          <Subtle className="mt-2">Loading device info...</Subtle>
        </div>
      ) : (
        <>
          <div className="flex justify-between px-8 pt-6">
            <div>
              <span className="text-lg font-medium">
                {myNode.user?.shortName ?? "UNK"}
              </span>
              <Subtle>
                {deviceNameParser(myNode.user?.longName) ?? "UNK"}
              </Subtle>
            </div>
            <button
              type="button"
              className="transition-all hover:text-accent"
              onClick={() => setDialogOpen("deviceName", true)}
            >
              <EditIcon size={16} />
            </button>
          </div>
          <div className="px-8 pb-6">
            <div className="flex items-center">
              <BatteryMediumIcon size={24} viewBox="0 0 28 24" />
              <Subtle>
                {myNode.deviceMetrics?.batteryLevel
                  ? myNode.deviceMetrics.batteryLevel > 100
                    ? "Charging"
                    : `${myNode.deviceMetrics.batteryLevel}%`
                  : "UNK"}
              </Subtle>
            </div>
            <div className="flex items-center">
              <ZapIcon size={24} viewBox="0 0 36 24" />
              <Subtle>
                {myNode.deviceMetrics?.voltage?.toPrecision(3) ?? "UNK"} volts
              </Subtle>
            </div>
            <div className="flex items-center">
              <CpuIcon size={24} viewBox="0 0 36 24" />
              <Subtle>v{myMetadata?.firmwareVersion ?? "UNK"}</Subtle>
            </div>
          </div>
        </>
      )}

      <SidebarSection label="Navigation">
        {pages.map((link) => (
          <SidebarButton
            key={link.name}
            label={link.name}
            Icon={link.icon}
            onClick={() => {
              if (myNode !== undefined) {
                setActivePage(link.page);
                setShowSidebar(false);
              }
            }}
            active={link.page === activePage}
            disabled={myNode === undefined}
          />
        ))}
      </SidebarSection>
      {children}
    </div>
  ) : null;
};
