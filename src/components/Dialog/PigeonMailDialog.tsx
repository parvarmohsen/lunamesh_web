import { Button } from "@components/UI/Button.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/UI/Dialog.tsx";
import { Input } from "@components/UI/Input.tsx";
import { Label } from "@components/UI/Label.tsx";
import { toast } from "@core/hooks/useToast.ts";
import { useAppStore } from "@core/stores/appStore.ts";
import { useDevice } from "@core/stores/deviceStore.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { distance } from "@turf/turf";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Textarea } from "../UI/Textarea.tsx";

// --- Validation Schema ---
const NodeIdRegex = /^![0-9a-fA-F]{8}$/;

const pigeonMailSchema = z
  .object({
    longitude: z.number().min(-180).max(180),
    latitude: z.number().min(-90).max(90),
    altitude: z.number().min(0).max(120).default(30),
    text: z.string(), // Byte length validation done separately
    recipientNodeId: z
      .string()
      .regex(NodeIdRegex, "Invalid NodeID format (e.g., !abcdef12)")
      .default("!433d78a8"),
    droneNodeId: z
      .string()
      .regex(NodeIdRegex, "Invalid NodeID format (e.g., !abcdef12)")
      .default("!433d7cd8"),
    channel: z.number().int().min(0).max(7).default(0),
  })
  .refine(
    (data) => {
      const byteLength = new TextEncoder().encode(data.text).length;
      return byteLength <= 100;
    },
    {
      message: "Text message must not exceed 100 bytes",
      path: ["text"],
    }
  );

type PigeonMailFormData = z.infer<typeof pigeonMailSchema>;

// --- Component Props ---
export interface PigeonMailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordinates: { lng: number; lat: number } | null;
}

// --- Component ---
export const PigeonMailDialog = ({
  open,
  onOpenChange,
  coordinates,
}: PigeonMailDialogProps) => {
  const { connection, hardware, nodes } = useDevice();
  const { userPosition } = useAppStore();
  const [textByteCount, setTextByteCount] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isValid },
  } = useForm<PigeonMailFormData>({
    resolver: zodResolver(pigeonMailSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      altitude: 30,
      recipientNodeId: "!433d78a8",
      droneNodeId: "!433d7cd8",
      text: "",
      channel: 0,
    },
  });

  // Handle dialog open/close with state reset
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when dialog closes
      reset();
      setTextByteCount(0);
    }
    onOpenChange(open);
  };

  // Get current user location from app store
  useEffect(() => {
    if (userPosition) {
      setCurrentLocation({
        lat: userPosition[1],
        lng: userPosition[0],
      });
    }
  }, [userPosition]);

  // Update form when coordinates change from the map
  useEffect(() => {
    if (coordinates) {
      // Use setValue to update only lat/lon, preserving other fields
      setValue("latitude", coordinates.lat, { shouldValidate: true });
      setValue("longitude", coordinates.lng, { shouldValidate: true });
    }
    // Reset text byte count remains the same
    setTextByteCount(new TextEncoder().encode(watch("text") ?? "").length);
  }, [coordinates, setValue, watch]);

  // Watch text field to update byte count
  const textValue = watch("text");
  useEffect(() => {
    setTextByteCount(new TextEncoder().encode(textValue ?? "").length);
  }, [textValue]);

  // Distance Validation
  const isDistanceValid = useMemo(() => {
    if (!currentLocation || !coordinates) return true; // Cannot validate yet
    const from = [currentLocation.lng, currentLocation.lat];
    const to = [coordinates.lng, coordinates.lat];
    const dist = distance(from, to, { units: "kilometers" });
    return dist <= 20;
  }, [currentLocation, coordinates]);

  // Add this useEffect at the top of the component, after the other useEffects
  useEffect(() => {
    return () => {
      // Reset form state when component unmounts
      reset();
    };
  }, [reset]);

  // --- Form Submission ---
  const onSubmit = async (data: PigeonMailFormData): Promise<void> => {
    if (!connection && import.meta.env.MODE !== "development") {
      toast({ title: "Error", description: "No device connected." });
      return;
    }
    if (!isDistanceValid) {
      toast({
        title: "Error",
        description: "Destination is more than 20km away.",
      });
      return;
    }

    const textBytes = new TextEncoder().encode(data.text);

    // Construct the payload (Figure 2)
    const payload = new Uint8Array(1 + 4 + 9 + 9 + 1 + 1 + textBytes.length);
    const dataView = new DataView(payload.buffer);
    let offset = 0;

    // 1. Magic Prefix (1 byte)
    dataView.setUint8(offset, 170); // 10101010b
    offset += 1;

    // 2. Recipient NodeID (4 bytes)
    const recipientId = Number.parseInt(data.recipientNodeId.substring(1), 16);
    dataView.setUint32(offset, recipientId, false); // Assuming Big Endian
    offset += 4;

    // 3. Longitude (9 bytes - Placeholder, needs encoding decision)
    // Store longitude as float64 (8 bytes) plus 1 byte for precision
    const lonBuffer = new ArrayBuffer(8);
    const lonView = new DataView(lonBuffer);
    lonView.setFloat64(0, data.longitude, false); // false = big-endian
    for (let i = 0; i < 8; i++) {
      dataView.setUint8(offset + i, new Uint8Array(lonBuffer)[i]);
    }
    // Add precision byte (use 7 for 7 decimal places)
    dataView.setUint8(offset + 8, 7);
    offset += 9;

    // 4. Latitude (9 bytes)
    // Store latitude as float64 (8 bytes) plus 1 byte for precision
    const latBuffer = new ArrayBuffer(8);
    const latView = new DataView(latBuffer);
    latView.setFloat64(0, data.latitude, false); // false = big-endian
    for (let i = 0; i < 8; i++) {
      dataView.setUint8(offset + i, new Uint8Array(latBuffer)[i]);
    }
    // Add precision byte (use 7 for 7 decimal places)
    dataView.setUint8(offset + 8, 7);
    offset += 9;

    // 5. Altitude (1 byte)
    // Ensure altitude is rounded to an integer and fits in a byte (0-255)
    const altitudeInt = Math.min(255, Math.max(0, Math.round(data.altitude)));
    dataView.setUint8(offset, altitudeInt);
    offset += 1;

    // 6. Text Length (1 byte)
    dataView.setUint8(offset, textBytes.length);
    offset += 1;

    // 7. Text (variable length)
    payload.set(textBytes, offset);

    // --- Send the message ---
    try {
      const droneNodeNum = Number.parseInt(data.droneNodeId.substring(1), 16);
      const recipientNodeNum = Number.parseInt(
        data.recipientNodeId.substring(1),
        16
      );

      // Log the complete payload information
      console.log("Pigeon Mail Payload:", {
        magicPrefix: "0xAA (170)",
        recipientNodeId: `${data.recipientNodeId} (${recipientNodeNum})`,
        droneNodeId: `${data.droneNodeId} (${droneNodeNum})`,
        longitude: data.longitude,
        latitude: data.latitude,
        altitude: altitudeInt,
        textLength: textBytes.length,
        text: data.text,
        rawPayload: Array.from(payload)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" "),
      });

      console.log("Pigeon Mail Payload:", payload);

      // Extract data from payload for verification
      const extractedData = {
        magicPrefix: dataView.getUint8(0),
        recipientNodeId: dataView.getUint32(1, false),
        longitude: new DataView(payload.buffer.slice(5, 13)).getFloat64(
          0,
          false
        ),
        precision1: dataView.getUint8(13),
        latitude: new DataView(payload.buffer.slice(14, 22)).getFloat64(
          0,
          false
        ),
        precision2: dataView.getUint8(22),
        altitude: dataView.getUint8(23),
        textLength: dataView.getUint8(24),
        text: new TextDecoder().decode(
          payload.slice(25, 25 + dataView.getUint8(24))
        ),
      };
      console.log("Extracted Data:", extractedData);

      // Encapsulate the payload in a Meshtastic message and send it to the drone
      // We'll use a special portnum (64 = PRIVATE_APP) to indicate this is a custom application
      // Base64 encode the binary payload for transmission
      const base64Payload = btoa(String.fromCharCode(...payload));

      // Send the payload to the drone node
      // Using the sendText method with a special prefix to indicate it's binary data
      // Format: !BIN!<base64-encoded-payload>
      const messageId = await connection?.sendText(
        `!BIN!${base64Payload}`,
        droneNodeNum,
        true, // wantAck
        data.channel
      );

      if (messageId !== undefined) {
        toast({
          title: "Success",
          description: "Pigeon mail payload sent to Luna Mesh drone.",
        });
        onOpenChange(false); // Close dialog on success
      } else {
        onOpenChange(false); // Close dialog on success

        throw new Error("Failed to send message - no message ID returned");
      }
    } catch (e) {
      console.error("Error preparing pigeon mail:", e);
      toast({ title: "Error", description: `Failed to send payload: ${e}` });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white text-black dark:bg-black dark:text-white">
        <DialogClose />
        <DialogHeader>
          <DialogTitle className="dark:text-white">
            Send Pigeon Mail
          </DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            Configure and send a message via drone delivery. Destination must be
            within 20km.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4">
          {/* Coordinates (Now Editable) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="any"
                placeholder="Enter latitude (-90 to 90)"
                {...register("latitude", { valueAsNumber: true })}
                className="placeholder:text-muted-foreground/70"
              />
              {errors.latitude && (
                <p className="text-sm text-red-500">
                  {errors.latitude.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="any"
                placeholder="Enter longitude (-180 to 180)"
                {...register("longitude", { valueAsNumber: true })}
                className="placeholder:text-muted-foreground/70"
              />
              {errors.longitude && (
                <p className="text-sm text-red-500">
                  {errors.longitude.message}
                </p>
              )}
            </div>
          </div>
          {!isDistanceValid && (
            <p className="text-sm text-red-500">
              Destination is over 20km away.
            </p>
          )}

          {/* Altitude */}
          <div>
            <Label htmlFor="altitude">Altitude (meters)</Label>
            <Input
              id="altitude"
              type="number"
              placeholder="Enter altitude in meters (0-120)"
              className="placeholder:text-muted-foreground/70"
              {...register("altitude", { valueAsNumber: true })}
            />
            {errors.altitude && (
              <p className="text-sm text-red-500">{errors.altitude.message}</p>
            )}
          </div>

          {/* Text Message */}
          <div>
            <Label htmlFor="text">Message ({textByteCount}/100 bytes)</Label>
            <Textarea
              id="text"
              {...register("text")}
              rows={3}
              placeholder="Enter your message here (max 100 bytes)"
              className="placeholder:text-muted-foreground/70"
            />
            {errors.text && (
              <p className="text-sm text-red-500">{errors.text.message}</p>
            )}
          </div>

          {/* Node IDs */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recipientNodeId">Recipient NodeID</Label>
              <Input
                id="recipientNodeId"
                {...register("recipientNodeId")}
                placeholder="Enter recipient NodeID (e.g., !433d78a8)"
                className="placeholder:text-muted-foreground/70"
              />
              {errors.recipientNodeId && (
                <p className="text-sm text-red-500">
                  {errors.recipientNodeId.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="droneNodeId">Drone NodeID</Label>
              <Input
                id="droneNodeId"
                {...register("droneNodeId")}
                placeholder="Enter drone NodeID (e.g., !433d7cd8)"
                className="placeholder:text-muted-foreground/70"
              />
              {errors.droneNodeId && (
                <p className="text-sm text-red-500">
                  {errors.droneNodeId.message}
                </p>
              )}
            </div>
          </div>

          {/* Channel Selection */}
          <div>
            <Label htmlFor="channel">Channel</Label>
            <Input
              id="channel"
              type="number"
              min="0"
              max="7"
              placeholder="0 (default)"
              className="placeholder:text-muted-foreground/70"
              {...register("channel", { valueAsNumber: true })}
            />
            {errors.channel && (
              <p className="text-sm text-red-500">{errors.channel.message}</p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!isValid || !isDistanceValid}
              className="w-full sm:w-auto"
              onClick={handleSubmit(onSubmit)}
            >
              Send Message
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
