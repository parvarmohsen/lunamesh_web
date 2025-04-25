import { Button } from "@components/UI/Button.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import { PlusIcon } from "lucide-react";

interface ConnectionButtonProps {
  size?: "small" | "default";
}

export const ConnectionButton = ({
  size = "default",
}: ConnectionButtonProps) => {
  const { setConnectDialogOpen, userPosition, locationError } = useAppStore();

  if (size === "small") {
    return (
      <button
        type="button"
        title="Connect New Device"
        onClick={() => setConnectDialogOpen(true)}
        disabled={!userPosition || !!locationError}
        className="transition-all duration-300"
      >
        <PlusIcon size={16} />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        className="gap-2 dark:bg-white dark:text-slate-900 dark:hover:text-slate-100"
        variant="default"
        onClick={() => setConnectDialogOpen(true)}
        disabled={!userPosition || !!locationError}
      >
        <PlusIcon size={16} />
        {!userPosition ? "Getting your position..." : "New Connection"}
      </Button>
      {locationError && <p className="text-sm text-red-500">{locationError}</p>}
    </div>
  );
};
