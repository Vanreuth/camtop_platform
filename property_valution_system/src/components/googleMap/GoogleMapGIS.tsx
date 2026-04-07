"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { GoogleMapGISProps } from "@/types/googleMap.types";
import { MapLogic } from "@/components/googleMap/mapLogic";

export const GoogleMapGIS = ({
  coordinates = { latitude: 11.5564, longitude: 104.9282 },
  addressCodes,
  preservePinWhenInsideSelectedBoundary = false,
  onCoordinatesChange,
  onAddressCodesChange,
  onReverseGeocode,
  googleMapsApiKey =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "",
  mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "",
  height = "600px",
  enableShapeDrawing = false,
  onShapesChange,
  existingPolygon,
  disableBoundaryPinUpdate = false,
  mapType: controlledMapType,
  onMapTypeChange,
  onMapLoad,
  showMarker = true,
}: GoogleMapGISProps) => {
  const effectiveMapId = mapId || "DEMO_MAP_ID";
  const center = useMemo(
    () => ({
      lat: coordinates.latitude,
      lng: coordinates.longitude,
    }),
    [coordinates.latitude, coordinates.longitude]
  );

  // Unique overlay root ID to prevent conflicts
  const overlayRootId = useRef(`gm-ui-overlay-${Date.now()}`).current;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  
  // ✅ NEW: Map type state
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid" | "terrain">(
    controlledMapType ?? "roadmap"
  );

  useEffect(() => {
    if (controlledMapType) {
      setMapType(controlledMapType);
    }
  }, [controlledMapType]);

  // Validate API key
  useEffect(() => {
    if (!googleMapsApiKey) {
      setMapError(
        "Google Maps API key is missing. Please set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY."
      );
    }
  }, [googleMapsApiKey]);

  // Handle fullscreen changes
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("mozfullscreenchange", onFullscreenChange);
    document.addEventListener("MSFullscreenElementChange", onFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("mozfullscreenchange", onFullscreenChange);
      document.removeEventListener("MSFullscreenElementChange", onFullscreenChange);
    };
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;

    try {
      if (!document.fullscreenElement) {
        if (el.requestFullscreen) {
          el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          (el as any).webkitRequestFullscreen();
        } else if ((el as any).mozRequestFullScreen) {
          (el as any).mozRequestFullScreen();
        } else if ((el as any).msRequestFullscreen) {
          (el as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (error) {
      console.error("Fullscreen toggle error:", error);
    }
  }, []);

  // Error state
  if (mapError) {
    return (
      <div
        className="relative w-full overflow-hidden rounded-xl border border-red-200 bg-red-50 shadow flex items-center justify-center"
        style={{ height }}
      >
        <div className="text-center p-6 max-w-md">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-900 mb-2">Map Loading Error</h3>
          <p className="text-sm text-red-700">{mapError}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .google-map-gis-native-pegman .gm-style .gm-svpc {
          margin-top: ${enableShapeDrawing ? 104 : 72}px !important;
        }
      `}</style>
      <div
        ref={wrapperRef}
        className={`google-map-gis-native-pegman relative w-full overflow-hidden rounded-xl border shadow transition-all ${
          isFullscreen ? "fixed inset-0 z-50 rounded-none" : ""
        }`}
        style={{ height: isFullscreen ? "100vh" : height }}
      >
      {/* UI overlay ABOVE the map - prevents click conflicts inside Tabs */}
      <div id={overlayRootId} className="absolute inset-0 z-20 pointer-events-none" />

      <APIProvider
        apiKey={googleMapsApiKey}
        libraries={["geometry", "marker"]}
      >
        <Map
          defaultCenter={center}
          defaultZoom={7}
          mapId={effectiveMapId}
          gestureHandling="greedy"
          disableDefaultUI={false}
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <MapLogic
            initialCoords={coordinates}
            addressCodes={addressCodes}
            preservePinWhenInsideSelectedBoundary={preservePinWhenInsideSelectedBoundary}
            onCoordinatesChange={onCoordinatesChange}
            onAddressCodesChange={onAddressCodesChange}
            onReverseGeocode={onReverseGeocode}
            enableShapeDrawing={enableShapeDrawing}
            onShapesChange={onShapesChange}
            existingPolygon={existingPolygon ?? undefined}
            disableBoundaryPinUpdate={disableBoundaryPinUpdate}
            overlayRootId={overlayRootId}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
            mapType={controlledMapType ?? mapType}
            onMapTypeChange={onMapTypeChange ?? setMapType}
            onMapLoad={onMapLoad}
            showMarker={showMarker}
          />
        </Map>
      </APIProvider>
      </div>
    </>
  );
};
