import { Separator } from "@components/UI/Seperator.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import { useDeviceStore } from "@core/stores/deviceStore.ts";
import { MapIcon, MessageSquareIcon } from "lucide-react";

export const DeviceActions = () => {
  const { selectedDevice } = useAppStore();
  const { getDevice } = useDeviceStore();

  const device = selectedDevice ? getDevice(selectedDevice) : undefined;

  if (!device) {
    return null;
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <Separator />
      <button
        type="button"
        title="Messages"
        className={`p-2 rounded-lg transition-all ${
          device.activePage === "messages"
            ? "text-accent bg-accent/10 scale-110"
            : "text-slate-500 hover:text-accent hover:bg-accent/5"
        }`}
        onClick={() => device.setActivePage("messages")}
      >
        <MessageSquareIcon className="w-5 h-5" />
      </button>
      <button
        type="button"
        title="Map"
        className={`p-2 rounded-lg transition-all ${
          device.activePage === "map"
            ? "text-accent bg-accent/10 scale-110"
            : "text-slate-500 hover:text-accent hover:bg-accent/5"
        }`}
        onClick={() => device.setActivePage("map")}
      >
        <MapIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
