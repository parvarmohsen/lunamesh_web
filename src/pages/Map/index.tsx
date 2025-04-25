import { PigeonMailDialog } from "@components/Dialog/PigeonMailDialog.tsx";
import { PageLayout } from "@components/PageLayout.tsx";
import { Sidebar } from "@components/Sidebar.tsx";
import { useNodeFilters } from "@core/hooks/useNodeFilters.ts";
import { useAppStore } from "@core/stores/appStore.ts";
import { useDevice } from "@core/stores/deviceStore.ts";
import type { Protobuf } from "@meshtastic/core";
import { FilterControl } from "@pages/Map/FilterControl.tsx";
import { bbox, circle, lineString, type Units } from "@turf/turf";
import { MapPinIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapGl, {
  AttributionControl,
  Layer,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  useMap,
  type MapLayerMouseEvent,
  type MapLayerTouchEvent,
} from "react-map-gl/maplibre";
import { NodeDetail } from "../../components/PageComponents/Map/NodeDetail.tsx";
import { Avatar } from "../../components/UI/Avatar.tsx";
import { useTheme } from "../../core/hooks/useTheme.ts";

type NodePosition = {
  latitude: number;
  longitude: number;
};

const convertToLatLng = (position: {
  latitudeI?: number;
  longitudeI?: number;
}): NodePosition => ({
  latitude: (position.latitudeI ?? 0) / 1e7,
  longitude: (position.longitudeI ?? 0) / 1e7,
});

const MapPage = () => {
  const { nodes, waypoints } = useDevice();
  const { theme } = useTheme();
  const { default: map } = useMap();
  const { userPosition, setUserPosition, locationError, setLocationError } =
    useAppStore();
  const longPressTimeoutRef = useRef<number | null>(null);
  const touchStartPositionRef = useRef<{ lng: number; lat: number } | null>(
    null
  );

  const darkMode = theme === "dark";

  const [selectedNode, setSelectedNode] =
    useState<Protobuf.Mesh.NodeInfo | null>(null);
  const [pigeonDialogOpen, setPigeonDialogOpen] = useState(false);
  const [pigeonCoordinates, setPigeonCoordinates] = useState<{
    lng: number;
    lat: number;
  } | null>(null);

  // Filter out nodes without a valid position
  const validNodes = useMemo(
    () =>
      Array.from(nodes.values()).filter(
        (node): node is Protobuf.Mesh.NodeInfo =>
          Boolean(node.position?.latitudeI)
      ),
    [nodes]
  );

  const {
    filteredNodes,
    filters,
    onFilterChange,
    resetFilters,
    filterConfigs,
  } = useNodeFilters(validNodes);

  // Create circle source data
  const circleSource = useMemo(() => {
    if (!userPosition) {
      console.log("No user position available for circle");
      return null;
    }
    const center = [userPosition[0], userPosition[1]];
    const radius = 20; // 20 kilometers
    const options = { steps: 64, units: "kilometers" as Units };
    const circleGeometry = circle(center, radius, options);

    return {
      type: "Feature" as const,
      properties: {},
      geometry: circleGeometry.geometry,
    };
  }, [userPosition]);

  const handleMarkerClick = useCallback(
    (node: Protobuf.Mesh.NodeInfo, event: { originalEvent: MouseEvent }) => {
      event?.originalEvent?.stopPropagation();
      setSelectedNode(node);
      if (map) {
        const position = convertToLatLng(node.position);
        map.easeTo({
          center: [position.longitude, position.latitude],
          zoom: map?.getZoom(),
        });
      }
    },
    [map]
  );

  // Handle right-click/long-press on map
  const handleMapContextMenu = useCallback((event: MapLayerMouseEvent) => {
    event.preventDefault(); // Prevent default browser context menu
    setPigeonCoordinates(event.lngLat);
    setPigeonDialogOpen(true);
    setSelectedNode(null); // Close node popup if open
  }, []);

  // Handle touch start for long press detection
  const handleTouchStart = useCallback((event: MapLayerTouchEvent) => {
    if (event.lngLat) {
      touchStartPositionRef.current = event.lngLat;
      longPressTimeoutRef.current = window.setTimeout(() => {
        if (touchStartPositionRef.current) {
          setPigeonCoordinates(touchStartPositionRef.current);
          setPigeonDialogOpen(true);
          setSelectedNode(null);
        }
      }, 500); // 500ms for long press
    }
  }, []);

  // Handle touch end to clear timeout if touch ends before long press
  const handleTouchEnd = useCallback((_event: MapLayerTouchEvent) => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    touchStartPositionRef.current = null;
  }, []);

  // Handle touch move to cancel long press if finger moves
  const handleTouchMove = useCallback((_event: MapLayerTouchEvent) => {
    if (longPressTimeoutRef.current !== null) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  // Get the bounds of the map based on the nodes furtherest away from center
  const getMapBounds = useCallback(() => {
    if (!map) {
      return;
    }

    if (!validNodes.length) {
      return;
    }
    if (validNodes.length === 1) {
      map.easeTo({
        zoom: 16,
        center: [
          (validNodes[0].position?.longitudeI ?? 0) / 1e7,
          (validNodes[0].position?.latitudeI ?? 0) / 1e7,
        ],
      });
      return;
    }
    const line = lineString(
      validNodes.map((n) => [
        (n.position?.latitudeI ?? 0) / 1e7,
        (n.position?.longitudeI ?? 0) / 1e7,
      ])
    );
    const bounds = bbox(line);
    const center = map.cameraForBounds(
      [
        [bounds[1], bounds[0]],
        [bounds[3], bounds[2]],
      ],
      { padding: { top: 10, bottom: 10, left: 10, right: 10 } }
    );
    if (center) {
      map.easeTo(center);
    }
  }, [map, validNodes]);

  // Generate all markers
  const markers = useMemo(
    () =>
      filteredNodes.map((node) => {
        const position = convertToLatLng(node.position);
        return (
          <Marker
            key={`marker-${node.num}`}
            longitude={position.longitude}
            latitude={position.latitude}
            anchor="bottom"
            onClick={(e) => handleMarkerClick(node, e)}
          >
            <Avatar
              text={node.user?.shortName?.toString() ?? node.num.toString()}
              className="border-[1.5px] border-slate-600 shadow-xl shadow-slate-600"
            />
          </Marker>
        );
      }),
    [filteredNodes, handleMarkerClick]
  );

  useEffect(() => {
    map?.on("load", () => {
      getMapBounds();
    });
  }, [map, getMapBounds]);

  return (
    <>
      <Sidebar />
      <PageLayout label="Map" noPadding actions={[]}>
        <MapGl
          mapStyle="https://raw.githubusercontent.com/hc-oss/maplibre-gl-styles/master/styles/osm-mapnik/v8/default.json"
          attributionControl={false}
          renderWorldCopies={false}
          maxPitch={0}
          style={{
            filter: darkMode ? "brightness(0.9)" : "",
          }}
          dragRotate={false}
          touchZoomRotate={false}
          initialViewState={{
            zoom: 1.8,
            latitude: 35,
            longitude: 0,
          }}
          onContextMenu={handleMapContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          <AttributionControl
            style={{
              background: darkMode ? "#ffffff" : "",
              color: darkMode ? "black" : "",
            }}
          />
          <NavigationControl position="top-right" showCompass={false} />
          <ScaleControl />
          <div className="absolute bottom-24 right-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={getMapBounds}
              className="bg-white dark:bg-slate-800 p-2 rounded-lg shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Recenter map"
            >
              <MapPinIcon
                size={16}
                className="text-slate-900 dark:text-white"
              />
            </button>
          </div>
          {locationError && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                left: "50%",
                transform: "translateX(-50%)",
                backgroundColor: "rgba(255, 0, 0, 0.8)",
                color: "white",
                padding: "8px 16px",
                borderRadius: "4px",
                zIndex: 1000,
              }}
            >
              {locationError}
            </div>
          )}
          {userPosition && (
            <>
              <Marker
                longitude={userPosition[0]}
                latitude={userPosition[1]}
                anchor="bottom"
              >
                <div className="bg-blue-500 rounded-full p-1">
                  <MapPinIcon size={16} className="text-white" />
                </div>
              </Marker>
              <Source type="geojson" data={circleSource}>
                <Layer
                  id="user-radius-circle-fill"
                  type="fill"
                  paint={{
                    "fill-color": "#3b82f6",
                    "fill-opacity": 0.15,
                  }}
                />
                <Layer
                  id="user-radius-circle-line"
                  type="line"
                  paint={{
                    "line-color": "#22c55e",
                    "line-width": 3,
                    "line-opacity": 0.8,
                  }}
                />
              </Source>
            </>
          )}
          {waypoints.map((wp) => (
            <Marker
              key={wp.id}
              longitude={(wp.longitudeI ?? 0) / 1e7}
              latitude={(wp.latitudeI ?? 0) / 1e7}
              anchor="bottom"
            >
              <div>
                <MapPinIcon size={16} />
              </div>
            </Marker>
          ))}
          {markers}
          {selectedNode ? (
            <Popup
              anchor="top"
              longitude={convertToLatLng(selectedNode.position).longitude}
              latitude={convertToLatLng(selectedNode.position).latitude}
              onClose={() => setSelectedNode(null)}
            >
              <NodeDetail node={selectedNode} />
            </Popup>
          ) : null}
        </MapGl>

        <FilterControl
          configs={filterConfigs}
          values={filters}
          onChange={onFilterChange}
          resetFilters={resetFilters}
        />
      </PageLayout>

      <PigeonMailDialog
        open={pigeonDialogOpen}
        onOpenChange={setPigeonDialogOpen}
        coordinates={pigeonCoordinates}
      />
    </>
  );
};

export default MapPage;
