export const PARTY_COLORS: Record<string, string> = {
  BJP: "#F97316",
  SP: "#EF4444",
  BSP: "#2563EB",
  INC: "#22C55E",
  RLD: "#EAB308",
  AIMIM: "#06B6D4",
  AAP: "#9333EA",
  "AD(S)": "#F59E0B",
  SBSP: "#EC4899",
  NISHAD: "#8B5CF6",
  IND: "#94A3B8",
  Others: "#94A3B8",
  OTH: "#94A3B8",
};

export const getPartyColor = (party?: string) => PARTY_COLORS[party || ""] || PARTY_COLORS.Others;
