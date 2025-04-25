import { create } from "@bufbuild/protobuf";
import { ConnectionButton } from "@components/ConnectionButton.tsx";
import { DeviceSelectorButton } from "@components/DeviceSelectorButton.tsx";
import ThemeSwitcher from "@components/ThemeSwitcher.tsx";
import { Avatar } from "@components/UI/Avatar.tsx";
import { Separator } from "@components/UI/Seperator.tsx";
import { Code } from "@components/UI/Typography/Code.tsx";
import { useAppStore } from "@core/stores/appStore.ts";
import { useDeviceStore } from "@core/stores/deviceStore.ts";
import { Protobuf, Types } from "@meshtastic/core";
import { HomeIcon, SearchIcon, TestTubeDiagonalIcon } from "lucide-react";
import { DeviceActions } from "./DeviceActions.tsx";

export const DeviceSelector = () => {
  const { getDevices, addDevice } = useDeviceStore();
  const {
    selectedDevice,
    setSelectedDevice,
    setCommandPaletteOpen,
    setConnectDialogOpen,
    userPosition,
  } = useAppStore();

  const handleMockConnect = () => {
    if (!userPosition) {
      console.log("User position not available, skipping mock connection.");
      return;
    }

    const mockDeviceId = 999; // Use a distinct ID for the mock device
    const existingDevice = getDevices().find((d) => d.id === mockDeviceId);

    if (existingDevice) {
      setSelectedDevice(mockDeviceId);
      console.log("Mock device already exists, selecting it.");
      return;
    }

    console.log("Creating mock device...");
    const mockDevice = addDevice(mockDeviceId);

    // Simulate connection process
    mockDevice.setStatus(Types.DeviceStatusEnum.DeviceConnected);
    mockDevice.setHardware(
      create(Protobuf.Mesh.MyNodeInfoSchema, {
        myNodeNum: mockDeviceId,
        rebootCount: 1,
      })
    );

    mockDevice.addNodeInfo(
      create(Protobuf.Mesh.NodeInfoSchema, {
        num: mockDeviceId,
        user: {
          id: "!mockusr",
          longName: "Mock Device",
          shortName: "MCK",
          macaddr: new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]),
          hwModel: Protobuf.Mesh.HardwareModel.TBEAM,
        },
        position: {
          latitudeI: userPosition[1] * 1e7 + 1000,
          longitudeI: userPosition[0] * 1e7 + 1600,
          altitude: 30,
          time: Math.floor(Date.now() / 1000),
        },
        lastHeard: Math.floor(Date.now() / 1000),
        deviceMetrics: {},
      })
    );
    // Add mock channel (optional)
    mockDevice.addChannel(
      create(Protobuf.Channel.ChannelSchema, {
        index: 0,
        settings: { name: "Mock Primary", psk: new Uint8Array([1]) }, // Simplified
        role: Protobuf.Channel.Channel_Role.PRIMARY,
      })
    );

    setSelectedDevice(mockDeviceId);
    console.log("Mock device created and selected.");
  };

  return (
    <nav className="flex flex-col justify-between border-r-[0.5px]  border-slate-300 pt-2 dark:border-slate-700">
      <div className="flex flex-col overflow-y-hidden">
        <ul className="flex w-20 grow flex-col items-center space-y-4 bg-transparent py-4 px-5">
          <DeviceSelectorButton
            active={selectedDevice === 0}
            onClick={() => {
              setSelectedDevice(0);
            }}
          >
            <HomeIcon />
          </DeviceSelectorButton>
          {getDevices().map((device) => (
            <DeviceSelectorButton
              key={device.id}
              onClick={() => {
                setSelectedDevice(device.id);
              }}
              active={selectedDevice === device.id}
            >
              <Avatar
                text={
                  device.nodes
                    .get(device.hardware.myNodeNum)
                    ?.user?.shortName.toString() ?? "UNK"
                }
              />
            </DeviceSelectorButton>
          ))}
          <Separator />
          <div className="flex flex-col items-center">
            <ConnectionButton size="small" />
          </div>
          {/* Add Mock Connection Button only in development */}
          {import.meta.env.MODE === "development" && (
            <button
              type="button"
              title="Add Mock Connection"
              onClick={handleMockConnect}
              className="transition-all duration-300 text-yellow-500 hover:text-yellow-400"
            >
              <TestTubeDiagonalIcon />
            </button>
          )}
          <DeviceActions />
        </ul>
      </div>
      <div className="flex w-20 flex-col items-center space-y-5 px-5 pb-5">
        <ThemeSwitcher />
        <button
          type="button"
          className="transition-all hover:text-accent"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <SearchIcon />
        </button>
        {/* TODO: This is being commented out until its fixed */}
        {/* <button type="button" className="transition-all hover:text-accent">
                 <LanguagesIcon />
               </button> */}
        <Separator />
        <Code>{import.meta.env.VITE_COMMIT_HASH}</Code>
      </div>
    </nav>
  );
};
