import { useAppStore } from "@core/stores/appStore.ts";
import { useDeviceStore } from "@core/stores/deviceStore.ts";
import { useEffect, useState } from "react";

// Default location in Libya (Tripoli coordinates)
const DEFAULT_LIBYA_LOCATION: [number, number] = [13.1913, 32.8872];
// Small offset to place user location near but not exactly at the device location
const LOCATION_OFFSET: [number, number] = [0.0003, 0.0002];

export const UserPositionTracker = (): null => {
  const { setUserPosition, setLocationError, selectedDevice } = useAppStore();
  const deviceStore = useDeviceStore();
  const [permissionStatus, setPermissionStatus] =
    useState<PermissionState | null>(null);
  const [isFirstError, setIsFirstError] = useState(true);

  useEffect(() => {
    let watchId: number | null = null;
    let retryTimeout: number | null = null;
    const isDevelopment = process.env.NODE_ENV === "development";
    const checkAndRequestPermission = async () => {
      try {
        // Check if the Permissions API is available
        if (!navigator.permissions) {
          console.warn("Permissions API not supported");
          setLocationError("Permissions API not supported");
          return "prompt";
        }

        const result = await navigator.permissions.query({
          name: "geolocation",
        });
        setPermissionStatus(result.state);

        // Listen for permission changes
        result.onchange = () => {
          setPermissionStatus(result.state);
          if (result.state === "granted") {
            updatePosition();
          }
        };

        return result.state;
      } catch (error) {
        console.error("Error checking permissions:", error);
        setLocationError("Error checking permissions");
        return "prompt";
      }
    };

    const updatePosition = () => {
      if (!navigator.geolocation) {
        console.error("Geolocation is not supported by this browser");
        setLocationError("Geolocation is not supported by this browser");
        return;
      }

      const successCallback = (position: GeolocationPosition) => {
        const { longitude, latitude } = position.coords;
        setUserPosition([longitude, latitude]);
        setLocationError(null);
        console.log("User position updated:", [longitude, latitude]);
        // Clear any existing retry timeout
        if (retryTimeout) {
          window.clearTimeout(retryTimeout);
          retryTimeout = null;
        }
      };

      const errorCallback = (error: GeolocationPositionError) => {
        console.error("Error getting location:", error);
        setLocationError(error.message);

        // Handle the error based on development environment and first occurrence
        if (isFirstError) {
          if (selectedDevice && selectedDevice !== 0 && isDevelopment) {
            // Try to get the selected device's position
            const device = deviceStore.getDevice(selectedDevice);
            if (device?.nodes) {
              // Get the device's own node (hardware.myNodeNum)
              const myNodeNum = device.hardware?.myNodeNum;
              if (myNodeNum !== undefined && device.nodes.has(myNodeNum)) {
                const nodeInfo = device.nodes.get(myNodeNum);
                if (nodeInfo?.position) {
                  // Use device position with a small offset if available
                  const latitudeI = nodeInfo.position.latitudeI;
                  const longitudeI = nodeInfo.position.longitudeI;
                  if (latitudeI !== undefined && longitudeI !== undefined) {
                    const lat = latitudeI / 10000000;
                    const lng = longitudeI / 10000000;
                    const userLat = lat + LOCATION_OFFSET[1];
                    const userLng = lng + LOCATION_OFFSET[0];
                    console.log(
                      "Setting user position next to selected device:",
                      [userLng, userLat]
                    );
                    setUserPosition([userLng, userLat]);
                    setLocationError(null);
                    setIsFirstError(false);
                    return;
                  }
                }
              }
            }
          }

          // Fall back to Libya if we couldn't find a device position
          if (isDevelopment) {
            console.log("Setting default location in Libya for development");
            setUserPosition(DEFAULT_LIBYA_LOCATION);
            setLocationError(null);
            setIsFirstError(false);
          }
        }

        // Only retry if permission is granted
        if (permissionStatus === "granted") {
          retryTimeout = window.setTimeout(updatePosition, 5000);
        }
      };

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      };

      // Start watching position
      watchId = navigator.geolocation.watchPosition(
        successCallback,
        errorCallback,
        options
      );
    };

    const initializeGeolocation = async () => {
      const permissionState = await checkAndRequestPermission();

      if (permissionState === "granted") {
        updatePosition();
      } else if (permissionState === "prompt") {
        // Request permission by trying to get current position
        navigator.geolocation.getCurrentPosition(
          () => {
            // Permission granted, start watching position
            updatePosition();
          },
          (error) => {
            console.error("Permission denied:", error);
            setLocationError(error.message);
          },
          {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          }
        );
      }
    };

    // Initialize geolocation
    initializeGeolocation();

    // Cleanup function
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
    };
  }, [
    permissionStatus,
    isFirstError,
    setUserPosition,
    setLocationError,
    selectedDevice,
    deviceStore,
  ]);

  return null;
};
