"use client";

import { useEffect, useRef, useState } from "react";
import { useElectionContext } from "@/context/ElectionContext";

// District-level winning party data for 2017 and 2022 UP elections
// This maps each district to its dominant party based on seats won in that district
const DISTRICT_DATA_2017: Record<string, { winner: string; bjp: number; sp: number; bsp: number; inc: number; oth: number }> = {
  "Agra": { winner: "BJP", bjp: 8, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Aligarh": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ambedkar Nagar": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Amethi": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Amroha": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Auraiya": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ayodhya": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Azamgarh": { winner: "BJP", bjp: 7, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Baghpat": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Bahraich": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ballia": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Balrampur": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Banda": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Barabanki": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Bareilly": { winner: "BJP", bjp: 6, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Basti": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Bhadohi": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Bijnor": { winner: "BJP", bjp: 5, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Budaun": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Bulandshahr": { winner: "BJP", bjp: 6, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Chandauli": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Chitrakoot": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Deoria": { winner: "BJP", bjp: 6, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Etah": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Etawah": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Farrukhabad": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Fatehpur": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Firozabad": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Gautam Buddha Nagar": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ghaziabad": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ghazipur": { winner: "BJP", bjp: 5, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Gonda": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Gorakhpur": { winner: "BJP", bjp: 8, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Hamirpur": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Hapur": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Hardoi": { winner: "BJP", bjp: 6, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Hathras": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Jalaun": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Jaunpur": { winner: "BJP", bjp: 7, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Jhansi": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kannauj": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kanpur Dehat": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kanpur Nagar": { winner: "BJP", bjp: 9, sp: 0, bsp: 0, inc: 1, oth: 0 },
  "Kasganj": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kaushambi": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kushinagar": { winner: "BJP", bjp: 5, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Lakhimpur Kheri": { winner: "BJP", bjp: 6, sp: 0, bsp: 1, inc: 0, oth: 0 },
  "Lalitpur": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Lucknow": { winner: "BJP", bjp: 8, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Maharajganj": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Mahoba": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Mainpuri": { winner: "SP", bjp: 1, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Mathura": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Mau": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Meerut": { winner: "BJP", bjp: 6, sp: 0, bsp: 1, inc: 0, oth: 0 },
  "Mirzapur": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Moradabad": { winner: "BJP", bjp: 4, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Muzaffarnagar": { winner: "BJP", bjp: 5, sp: 0, bsp: 1, inc: 0, oth: 0 },
  "Pilibhit": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Pratapgarh": { winner: "BJP", bjp: 5, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Prayagraj": { winner: "BJP", bjp: 10, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Rae Bareli": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 1, oth: 0 },
  "Rampur": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Saharanpur": { winner: "BJP", bjp: 5, sp: 0, bsp: 1, inc: 1, oth: 0 },
  "Sambhal": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Sant Kabir Nagar": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Shahjahanpur": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Shamli": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Shrawasti": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Siddharthnagar": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Sitapur": { winner: "BJP", bjp: 7, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Sonbhadra": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Sultanpur": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Unnao": { winner: "BJP", bjp: 5, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Varanasi": { winner: "BJP", bjp: 7, sp: 1, bsp: 0, inc: 0, oth: 0 },
};

const DISTRICT_DATA_2022: Record<string, { winner: string; bjp: number; sp: number; bsp: number; inc: number; oth: number }> = {
  "Agra": { winner: "BJP", bjp: 6, sp: 2, bsp: 0, inc: 0, oth: 1 },
  "Aligarh": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Ambedkar Nagar": { winner: "SP", bjp: 2, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Amethi": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Amroha": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Auraiya": { winner: "SP", bjp: 0, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Ayodhya": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Azamgarh": { winner: "SP", bjp: 3, sp: 6, bsp: 0, inc: 0, oth: 1 },
  "Baghpat": { winner: "SP", bjp: 1, sp: 1, bsp: 0, inc: 0, oth: 1 },
  "Bahraich": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Ballia": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Balrampur": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Banda": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Barabanki": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Bareilly": { winner: "BJP", bjp: 4, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Basti": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Bhadohi": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Bijnor": { winner: "SP", bjp: 2, sp: 4, bsp: 0, inc: 0, oth: 0 },
  "Budaun": { winner: "SP", bjp: 2, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Bulandshahr": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 1 },
  "Chandauli": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Chitrakoot": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Deoria": { winner: "BJP", bjp: 5, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Etah": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Etawah": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Farrukhabad": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Fatehpur": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Firozabad": { winner: "SP", bjp: 1, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Gautam Buddha Nagar": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ghaziabad": { winner: "BJP", bjp: 4, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Ghazipur": { winner: "SP", bjp: 3, sp: 4, bsp: 0, inc: 0, oth: 0 },
  "Gonda": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Gorakhpur": { winner: "BJP", bjp: 6, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Hamirpur": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Hapur": { winner: "BJP", bjp: 1, sp: 0, bsp: 0, inc: 0, oth: 1 },
  "Hardoi": { winner: "BJP", bjp: 5, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Hathras": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Jalaun": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Jaunpur": { winner: "SP", bjp: 3, sp: 5, bsp: 1, inc: 0, oth: 0 },
  "Jhansi": { winner: "BJP", bjp: 3, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kannauj": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Kanpur Dehat": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Kanpur Nagar": { winner: "BJP", bjp: 7, sp: 2, bsp: 0, inc: 0, oth: 1 },
  "Kasganj": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kaushambi": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Kushinagar": { winner: "BJP", bjp: 4, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Lakhimpur Kheri": { winner: "BJP", bjp: 4, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Lalitpur": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Lucknow": { winner: "BJP", bjp: 7, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Maharajganj": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Mahoba": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Mainpuri": { winner: "SP", bjp: 0, sp: 4, bsp: 0, inc: 0, oth: 0 },
  "Mathura": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Mau": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 1 },
  "Meerut": { winner: "BJP", bjp: 5, sp: 1, bsp: 0, inc: 0, oth: 1 },
  "Mirzapur": { winner: "BJP", bjp: 3, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Moradabad": { winner: "SP", bjp: 2, sp: 4, bsp: 0, inc: 0, oth: 0 },
  "Muzaffarnagar": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 1 },
  "Pilibhit": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Pratapgarh": { winner: "BJP", bjp: 4, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Prayagraj": { winner: "BJP", bjp: 8, sp: 3, bsp: 0, inc: 1, oth: 0 },
  "Rae Bareli": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 1, oth: 0 },
  "Rampur": { winner: "SP", bjp: 0, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Saharanpur": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 2 },
  "Sambhal": { winner: "SP", bjp: 1, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Sant Kabir Nagar": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Shahjahanpur": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Shamli": { winner: "SP", bjp: 0, sp: 1, bsp: 0, inc: 0, oth: 1 },
  "Shrawasti": { winner: "BJP", bjp: 2, sp: 0, bsp: 0, inc: 0, oth: 0 },
  "Siddharthnagar": { winner: "BJP", bjp: 3, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Sitapur": { winner: "BJP", bjp: 5, sp: 2, bsp: 0, inc: 0, oth: 0 },
  "Sonbhadra": { winner: "BJP", bjp: 2, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Sultanpur": { winner: "SP", bjp: 1, sp: 3, bsp: 0, inc: 0, oth: 0 },
  "Unnao": { winner: "BJP", bjp: 4, sp: 1, bsp: 0, inc: 0, oth: 0 },
  "Varanasi": { winner: "BJP", bjp: 6, sp: 2, bsp: 0, inc: 0, oth: 0 },
};

const PARTY_COLORS: Record<string, string> = {
  BJP: "#F97316",
  SP: "#EF4444",
  BSP: "#2563EB",
  INC: "#22C55E",
  Others: "#94A3B8",
};

function getDistrictColor(district: string, year: string): string {
  const data = year === "2017" ? DISTRICT_DATA_2017 : DISTRICT_DATA_2022;
  const d = data[district];
  if (!d) return "#D1D5DB";
  return PARTY_COLORS[d.winner] || "#94A3B8";
}

function getDistrictTooltip(district: string, year: string): string {
  const data = year === "2017" ? DISTRICT_DATA_2017 : DISTRICT_DATA_2022;
  const d = data[district];
  if (!d) return district;
  const total = d.bjp + d.sp + d.bsp + d.inc + d.oth;
  return `${district} (${total} seats)\nBJP: ${d.bjp} | SP: ${d.sp} | BSP: ${d.bsp} | INC: ${d.inc} | Others: ${d.oth}\nDominant: ${d.winner}`;
}

export default function UPMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const { viewMode } = useElectionContext();
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [tooltipData, setTooltipData] = useState<any>(null);

  const activeYear = viewMode === "2017 Only" ? "2017" : "2022";

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
        const res = await fetch("/up-districts.geojson");
        const geojsonData = await res.json();

        const geoLayer = L.geoJSON(geojsonData, {
          style: (feature: any) => {
            const district = feature?.properties?.district || "";
            return {
              fillColor: getDistrictColor(district, activeYear),
              weight: 1,
              opacity: 1,
              color: "#ffffff",
              fillOpacity: 0.75,
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const district = feature?.properties?.district || "";
            const data = activeYear === "2017" ? DISTRICT_DATA_2017 : DISTRICT_DATA_2022;
            const d = data[district];
            const total = d ? d.bjp + d.sp + d.bsp + d.inc + d.oth : 0;

            layer.bindTooltip(
              `<div style="font-family: system-ui; padding: 4px 0;">
                <strong style="font-size: 13px;">${district}</strong>
                <div style="font-size: 11px; color: #666; margin-top: 2px;">${total} constituencies</div>
                ${d ? `<div style="margin-top: 6px; font-size: 11px;">
                  <span style="color: #F97316;">BJP: ${d.bjp}</span> · 
                  <span style="color: #EF4444;">SP: ${d.sp}</span> · 
                  <span style="color: #2563EB;">BSP: ${d.bsp}</span>
                  ${d.inc > 0 ? ` · <span style="color: #22C55E;">INC: ${d.inc}</span>` : ''}
                  ${d.oth > 0 ? ` · <span style="color: #94A3B8;">Oth: ${d.oth}</span>` : ''}
                </div>
                <div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: ${PARTY_COLORS[d.winner] || '#333'};">
                  Winner: ${d.winner}
                </div>` : ''}
              </div>`,
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
                  weight: 2.5,
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

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [activeYear]);

  return (
    <div className="w-full h-full relative">
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
