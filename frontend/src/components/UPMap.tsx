"use client";

import { useEffect, useRef, useState } from "react";
import { useElectionContext } from "@/context/ElectionContext";
import { apiUrl } from "@/lib/api";

const PARTY_COLORS: Record<string, string> = {
  BJP: "#F97316",
  SP: "#EF4444",
  BSP: "#2563EB",
  INC: "#22C55E",
  RLD: "#EAB308",
  Others: "#94A3B8",
  OTH: "#94A3B8",
};

export default function UPMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const { viewMode } = useElectionContext();
  const [constituencyData, setConstituencyData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeYear = viewMode === "2017 Only" ? "2017" : "2022";

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

      // Light tile layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        maxZoom: 10,
        minZoom: 5,
      }).addTo(map);

      mapRef.current = map;

      // Load GeoJSON
      try {
        const res = await fetch("/up-constituencies.geojson");
        const geojsonData = await res.json();

        const geoLayer = L.geoJSON(geojsonData, {
          style: (feature: any) => {
            const rawName = feature?.properties?.AC_NAME || "";
            const constName = rawName.toLowerCase().replace('(sc)', '').replace('(st)', '').trim();
            const d = constituencyData[constName];
            const fillColor = d && d.winner ? (PARTY_COLORS[d.winner] || PARTY_COLORS.Others) : "#D1D5DB";
            
            return {
              fillColor,
              weight: 0.5,
              opacity: 1,
              color: "#ffffff",
              fillOpacity: 0.75,
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const rawName = feature?.properties?.AC_NAME || "";
            const constName = rawName.toLowerCase().replace('(sc)', '').replace('(st)', '').trim();
            const d = constituencyData[constName];

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

        // Fit bounds
        map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
      } catch (err) {
        console.error("Failed to load GeoJSON", err);
      }
    };

    if (!isLoading) {
      initMap();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeYear, constituencyData, isLoading]);

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

