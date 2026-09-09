"use client";

import { useEffect, useRef, useState } from "react";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";
import { PARTY_COLORS } from "@/lib/party-colors";

const normalizeConstituencyName = (value: string) => value
  .toLowerCase()
  .replace(/\[[^\]]*\]/g, "")
  .replace(/\s*\((?:sc|st)\)\s*/g, " ")
  .replace(/\s+/g, " ")
  .trim();

type MapLayerKey = "districts" | "highways" | "urban" | "rivers" | "railways";

type UPMapProps = {
  electionYear?: "2017" | "2022";
  region?: string;
  selectedName?: string;
  activeLayers?: Record<MapLayerKey, boolean>;
  partyFilter?: string;
  queryType?: string;
  showPartyWinners?: boolean;
  onSelect?: (value: { name: string; district?: string; winner?: string; winnerName?: string; margin?: number; code?: number }) => void;
};

const DEFAULT_LAYERS: Record<MapLayerKey, boolean> = {
  districts: true,
  highways: false,
  urban: false,
  rivers: false,
  railways: false,
};

const REGION_DISTRICTS: Record<string, string[]> = {
  "Western UP": ["Saharanpur", "Muzaffarnagar", "Shamli", "Meerut", "Baghpat", "Ghaziabad", "Hapur", "Bulandshahr", "Gautam Buddha Nagar", "Amroha", "Moradabad", "Rampur", "Bijnor", "Bareilly", "Badaun", "Pilibhit", "Shahjahanpur"],
  Rohilkhand: ["Bareilly", "Badaun", "Pilibhit", "Shahjahanpur", "Moradabad", "Rampur", "Bijnor", "Amroha"],
  Awadh: ["Lucknow", "Unnao", "Rae Bareli", "Barabanki", "Ayodhya", "Sultanpur", "Amethi", "Pratapgarh", "Lakhimpur Kheri", "Sitapur", "Hardoi", "Bahraich", "Gonda", "Balrampur", "Shrawasti"],
  Bundelkhand: ["Jhansi", "Lalitpur", "Jalaun", "Hamirpur", "Mahoba", "Banda", "Chitrakoot", "Fatehpur"],
  Purvanchal: ["Gorakhpur", "Deoria", "Kushinagar", "Maharajganj", "Azamgarh", "Mau", "Ballia", "Jaunpur", "Varanasi", "Ghazipur", "Mirzapur", "Sonbhadra", "Sant Kabir Nagar", "Basti", "Siddharthnagar", "Maharajganj"],
};

const matchesRegion = (district: string, region: string) => {
  if (!region || region === "All Regions") return true;
  const normalized = district.toLowerCase();
  return (REGION_DISTRICTS[region] || []).some((item) => normalized.includes(item.toLowerCase()));
};

export default function UPMap({ electionYear, region = "All Regions", selectedName, activeLayers = DEFAULT_LAYERS, partyFilter = "All Parties", queryType = "Constituencies by party", showPartyWinners = true, onSelect }: UPMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const { viewMode } = useElectionContext();
  const [constituencyData, setConstituencyData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeYear = electionYear || (viewMode === "2017 Only" ? "2017" : "2022");
  const selectedLayerRef = useRef<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/v1/analytics/constituencies-map?election_year=${activeYear}`));
        const data = await res.json();
        if (data.constituencies) {
          setConstituencyData(data.constituencies);
        }
      } catch (err) {
        console.error("Failed to fetch constituency map data", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeYear]);

  useEffect(() => {
    // Dynamic import for SSR safety
    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      if (!mapContainerRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [27.0, 80.5],
        zoom: 6,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false,
        dragging: true,
      });

      // Light base map. The feature overlays below are real tile/GeoJSON layers,
      // rather than a placeholder panel, and can be toggled independently.
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: 10,
        minZoom: 5,
      }).addTo(map);

      mapRef.current = map;

      const overlayLayers: Record<string, any> = {};
      const addTileOverlay = (key: MapLayerKey, url: string, opacity = 0.55) => {
        const layer = L.tileLayer(url, { opacity, maxZoom: 18, minZoom: 5, zIndex: key === "districts" ? 410 : 300 });
        overlayLayers[key] = layer;
        if (activeLayers[key]) layer.addTo(map);
      };
      addTileOverlay("highways", "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 0.32);
      addTileOverlay("urban", "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png", 0.7);
      addTileOverlay("rivers", "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 0.18);
      addTileOverlay("railways", "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", 0.22);
      (map as any).__featureOverlays = overlayLayers;

      // Load the actual 403-constituency GeoJSON from the repository.
      try {
        const res = await fetch("/up-constituencies.geojson");
        const geojsonData = await res.json();

        const geoLayer = L.geoJSON(geojsonData, {
          style: (feature: any) => {
            const rawName = feature?.properties?.AC_NAME || "";
            const constName = normalizeConstituencyName(rawName);
            const d = constituencyData[constName];
            const district = feature?.properties?.DIST_NAME || feature?.properties?.dtname11 || "";
            const visibleInRegion = matchesRegion(district, region);
            const partyMatches = partyFilter === "All Parties" || d?.winner === partyFilter;
            const fillColor = showPartyWinners && d && d.winner ? (PARTY_COLORS[d.winner] || PARTY_COLORS.Others) : "#D1D5DB";
            const margin = Number(d?.margin || 0);
            const queryColor = queryType === "Margin heatmap" ? (margin > 80000 ? "#166534" : margin > 40000 ? "#65a30d" : margin > 15000 ? "#f59e0b" : "#dc2626") : fillColor;
            const isSelected = normalizeConstituencyName(selectedName || "") === constName;
            
            return {
              fillColor: partyMatches ? queryColor : "#D1D5DB",
              weight: visibleInRegion && isSelected ? 3 : 0.5,
              opacity: 1,
              color: isSelected ? "#111827" : "#ffffff",
              fillOpacity: visibleInRegion && partyMatches ? (isSelected ? 0.92 : 0.75) : 0.04,
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const rawName = feature?.properties?.AC_NAME || "";
            const constName = normalizeConstituencyName(rawName);
            const d = constituencyData[constName];
            const district = feature?.properties?.DIST_NAME || feature?.properties?.dtname11 || "";
            const visibleInRegion = matchesRegion(district, region);
            const partyMatches = partyFilter === "All Parties" || d?.winner === partyFilter;

            const tooltipHtml = `<div style="font-family: system-ui; padding: 4px 0;">
                <strong style="font-size: 13px;">${rawName}</strong>
                ${d ? `<div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: ${PARTY_COLORS[d.winner] || '#333'};">
                  Winner: ${d.winner_name || "Unknown"} (${d.winner})
                </div>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">
                  Margin: ${d.margin ? d.margin.toLocaleString() : "Unknown"}
                </div>` : '<div style="margin-top: 4px; font-size: 11px; color: #666;">Data not available</div>'}
              </div>`;

            layer.bindTooltip(tooltipHtml,
              {
                sticky: true,
                direction: "top",
                offset: [0, -10],
                className: "district-tooltip",
              }
            );

            layer.on({
              click: () => {
                if (!visibleInRegion || !partyMatches) return;
                selectedLayerRef.current = layer;
                onSelect?.({
                  name: rawName,
                  district,
                  winner: d?.winner,
                  winnerName: d?.winner_name,
                  margin: d?.margin,
                  code: feature?.properties?.AC_NO,
                });
              },
              mouseover: (e: any) => {
                e.target.setStyle({
                  weight: 2,
                  color: "#1a1a1a",
                  fillOpacity: 0.9,
                });
                e.target.bringToFront();
              },
              mouseout: (e: any) => {
                geoLayer.resetStyle(e.target);
              },
            });
          },
        }).addTo(map);

        geoLayerRef.current = geoLayer;
        overlayLayers.districts = geoLayer;
        if (!activeLayers.districts) map.removeLayer(geoLayer);

        // Fit bounds
        map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
        const fitHandler = () => map.fitBounds(geoLayer.getBounds(), { padding: [20, 20], animate: true });
        window.addEventListener("up-map-fit", fitHandler);
        (map as any).__fitHandler = fitHandler;
      } catch (err) {
        console.error("Failed to load GeoJSON", err);
      }
    };

    if (!isLoading) {
      initMap();
    }

    return () => {
      if (mapRef.current && (mapRef.current as any).__fitHandler) window.removeEventListener("up-map-fit", (mapRef.current as any).__fitHandler);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeYear, constituencyData, isLoading, selectedName, region, partyFilter, queryType, showPartyWinners]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = (map as any).__featureOverlays || {};
    Object.entries(activeLayers).forEach(([key, enabled]) => {
      const layer = layers[key];
      if (!layer) return;
      if (enabled && !map.hasLayer(layer)) layer.addTo(map);
      if (!enabled && map.hasLayer(layer)) map.removeLayer(layer);
    });
  }, [activeLayers]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full rounded-xl" style={{ minHeight: "400px" }} />
      <style jsx global>{`
        .district-tooltip {
          background: var(--bg-surface, #fff) !important;
          border: 1px solid var(--border-subtle, #e5e7eb) !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important;
          color: var(--text-primary, #1a1a1a) !important;
        }
        .district-tooltip::before {
          display: none !important;
        }
        .leaflet-container {
          background: var(--bg-app, #f5f3ef) !important;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
}
