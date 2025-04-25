import { deviceNameParser } from "@app/core/utils/nameParser";
import { ConnectionButton } from "@components/ConnectionButton.tsx";
import { Separator } from "@components/UI/Seperator.tsx";
import { Heading } from "@components/UI/Typography/Heading.tsx";
import { Subtle } from "@components/UI/Typography/Subtle.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import { useDeviceStore } from "@core/stores/deviceStore.ts";
import type { MeshDevice } from "@meshtastic/core";
import { TransportHTTP } from "@meshtastic/transport-http";
import { TransportWebSerial } from "@meshtastic/transport-web-serial";
import {
  BluetoothIcon,
  ListPlusIcon,
  NetworkIcon,
  UsbIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo } from "react";
// Assuming a BLE transport class exists, import it here
// import { TransportWebBluetooth } from "@meshtastic/transport-web-bluetooth"; // Example import

export const Dashboard = () => {
  const { setConnectDialogOpen, setSelectedDevice } = useAppStore();
  const { getDevices } = useDeviceStore();

  const devices = useMemo(() => getDevices(), [getDevices]);

  // Helper function to get connection type string
  const getConnectionType = (connection?: MeshDevice): string => {
    if (!connection?.transport) return "unknown";
    if (connection.transport instanceof TransportHTTP) return "http";
    if (connection.transport instanceof TransportWebSerial) return "serial";
    // Add instanceof check for BLE transport when available
    // if (connection.transport instanceof TransportWebBluetooth) return "ble";
    // Fallback check based on common BLE transport property names if needed
    // This check is less reliable and might need adjustment based on actual BLE transport class
    if (
      connection.transport.constructor?.name
        ?.toLowerCase()
        .includes("bluetooth")
    )
      return "ble";
    return "unknown";
  };

  return (
    <>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Heading as="h3">Connected Devices</Heading>
            <Subtle>Manage, connect and disconnect devices</Subtle>
          </div>
        </div>

        <Separator />

        <div className="flex h-[450px] rounded-md border border-dashed border-slate-200 p-3 dark:border-slate-700">
          {devices.length ? (
            <ul className="grow divide-y divide-slate-200">
              {devices.map((device) => {
                const connType = getConnectionType(device.connection);
                return (
                  <li key={device.id}>
                    <button
                      type="button"
                      className="w-full px-4 py-4 sm:px-6"
                      onClick={() => {
                        setSelectedDevice(device.id);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <p className="truncate text-sm font-medium text-accent">
                          {deviceNameParser(
                            device.nodes.get(device.hardware.myNodeNum)?.user
                              ?.longName
                          ) ?? "UNK"}
                        </p>
                        <div className="inline-flex w-24 justify-center gap-2 rounded-full bg-slate-100 py-1 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-700 hover:text-slate-50">
                          {connType === "ble" && (
                            <>
                              <BluetoothIcon size={16} />
                              BLE
                            </>
                          )}
                          {connType === "serial" && (
                            <>
                              <UsbIcon size={16} />
                              Serial
                            </>
                          )}
                          {connType === "http" && (
                            <>
                              <NetworkIcon size={16} />
                              Network
                            </>
                          )}
                          {connType === "unknown" && (
                            <>? {/* Placeholder for unknown */}</>
                          )}
                        </div>
                        <div className="mt-2 sm:flex sm:justify-between">
                          <div className="flex gap-2 text-sm text-slate-500">
                            <UsersIcon
                              size={20}
                              className="text-slate-400"
                              aria-hidden="true"
                            />
                            {device.nodes.size === 0
                              ? 0
                              : device.nodes.size - 1}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="m-auto flex flex-col gap-3 text-center">
              <ListPlusIcon size={48} className="mx-auto text-text-secondary" />
              <Heading as="h3">No Devices</Heading>
              <Subtle>Connect at least one device to get started</Subtle>
              <ConnectionButton />
            </div>
          )}
        </div>
      </div>
    </>
  );
};
