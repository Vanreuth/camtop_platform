
import { DrawnShape } from "@/types/googleMap.types";

export type GeoJSONPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};
export interface PropertyLocationMarker {
  propertyId: number;
  propertyCode: string;
  propertyName: string;
  status: string;
  workflowStatus?: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
  googleMapLink?: string;
  polygon?: GeoJSONPolygon;
  hasValuation?: boolean;
  hasIndicativeValuation?: boolean;
  propertyType?: {
    propertyTypeId?: number;
    propertyName?: string;
    recordType?: {
      recordName?: string;
    };
  };
  valuation?: Array<{
    valuationId: number;
    valuationNo?: string;
    marketValue: number | null;
    forcedSaleValue: number | null;
    pricePerSqm?: number | null;
    valuationMethod?: string | null;
    valuationDate?: string | null;
    status?: string | null;
    workflowStatus?: string | null;
    preparedFor?: string | null;
    purposeOfValuation?: string | null;
  }>;
  indicativeValuation?: Array<{
    valuationId: number;
    indicationNo?: string;
    valuationNo?: string;
    minMarketValue: number | null;
    maxMarketValue: number | null;
    forcedSaleValue?: number | null;
    indicationDate?: string | null;
    status?: string | null;
    workflowStatus?: string | null;
    preparedFor?: string | null;
    purposeOfValuation?: string | null;
  }>;
  frontSide?: string;
  propertyPhotos?: {
    frontSide?: string;
  };
  transaction?: Array<{
    transactionType: string;
    totalPrice: number;
    transactionDate: string;
    pricePerSqm: number;
  }>;
  totalSizeByTitleDeed?: number;
  titleDocuments?: Array<{
    totalSizeByTitleDeed?: number | null;
  }>;
  propertyAddress?: {
    street?: string;
    houseNo?: string;
    province?: { code: string; nameKh: string; nameEn: string };
    district?: { code: string; nameKh: string; nameEn: string };
    commune?: { code: string; nameKh: string; nameEn: string };
  };
}

/**
 * Modern Gradient Status Badges (Compact)
 */
export function getStatusBadgeStyle(status: string): string {
  const statusUpper = status?.toUpperCase() || 'ACTIVE';
  // Reduced padding for compact look
  const base = "display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; text-transform: uppercase;";

  switch (statusUpper) {
    case 'ACTIVE': return `${base} background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;`;
    case 'INACTIVE': return `${base} background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;`;
    case 'SOLD': return `${base} background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;`;
    case 'RENTED': return `${base} background: #fffbeb; color: #b45309; border: 1px solid #fde68a;`;
    default: return `${base} background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;`;
  }
}

// Formatters
const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num);
const formatDate = (dateString: string) => !dateString ? '' : new Date(dateString).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); // Removed day to save space
const formatRange = (min: number | null, max: number | null) => {
  if (typeof min === "number" && typeof max === "number") {
    return `${formatCurrency(min)} - ${formatCurrency(max)}`;
  }
  if (typeof max === "number") return formatCurrency(max);
  if (typeof min === "number") return formatCurrency(min);
  return "";
};

const createStreetViewLink = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`;

/**
 * createInfoWindowContent - NO SCROLL VERSION
 * Uses CSS Grid to pack data tightly.
 */
export function createInfoWindowContent(
  property: PropertyLocationMarker,
  onViewDetails: string,
  locale?: string,
): string {
  const statusStyle = getStatusBadgeStyle(property.status);
  const localePrefix = locale ? `/${locale}` : "";
  
  // Truncate title to ensure 2 lines max
  const propertyName = property.propertyName.length > 50
    ? property.propertyName.substring(0, 48) + '...'
    : property.propertyName;

  const latestTransaction = property.transaction && property.transaction.length > 0
    ? property.transaction[0]
    : null;
  const propertyTypeName =
    property.propertyType?.propertyName ||
    property.propertyType?.recordType?.recordName ||
    "";
  const latestValuation = property.valuation && property.valuation.length > 0
    ? property.valuation[0]
    : null;
  const latestIndicativeValuation =
    property.indicativeValuation && property.indicativeValuation.length > 0
      ? property.indicativeValuation[0]
      : null;
  const hasDirectValuation = (property.valuation?.length ?? 0) > 0;
  const hasDirectIndicativeValuation = (property.indicativeValuation?.length ?? 0) > 0;
  const marketValue = latestValuation?.marketValue ?? null;
  const forcedSaleValue = latestValuation?.forcedSaleValue ?? null;
  const valuationPricePerSqm = latestValuation?.pricePerSqm ?? null;
  const hasValuationPrice = typeof marketValue === "number" && marketValue > 0;
  const hasForcedSale = typeof forcedSaleValue === "number" && forcedSaleValue > 0;
  const indicativeMinValue = latestIndicativeValuation?.minMarketValue ?? null;
  const indicativeMaxValue = latestIndicativeValuation?.maxMarketValue ?? null;
  const indicativeForcedSaleValue = latestIndicativeValuation?.forcedSaleValue ?? null;
  const indicativeRange = formatRange(indicativeMinValue, indicativeMaxValue);
  const hasIndicativeRange = indicativeRange.length > 0;
  const hasIndicativeForcedSale =
    typeof indicativeForcedSaleValue === "number" && indicativeForcedSaleValue > 0;
  const titleDeedSize = Number(
    property.totalSizeByTitleDeed ??
      property.titleDocuments?.[0]?.totalSizeByTitleDeed ??
      0
  );
  const hasTitleDeedSize = Number.isFinite(titleDeedSize) && titleDeedSize > 0;
  const valuationLink = latestValuation
    ? `${localePrefix}/dashboard/propertyValuation/${latestValuation.valuationId}`
    : "";
  const indicativeValuationLink = latestIndicativeValuation
    ? `${localePrefix}/dashboard/propertyIndicativeValuation/${latestIndicativeValuation.valuationId}`
    : "";

  // Address logic
  const province = property.propertyAddress?.province?.nameEn || '';
  const district = property.propertyAddress?.district?.nameEn || '';
  const commune  = property.propertyAddress?.commune?.nameEn || '';
  // Construct short location string
  const locationParts = [commune, district, province].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(', ') : (property.formattedAddress || 'Unknown Location');
  const streetViewLink = createStreetViewLink(property.latitude, property.longitude);

  const fontStack = "'Kantumruy Pro', 'Inter', system-ui, sans-serif";

  // --- HTML STRUCTURE ---
  return `
    <div style="
      font-family: ${fontStack};
      width: 280px; 
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      /* Remove box-shadow from here if Google Maps adds its own, otherwise keep subtle */
      box-shadow: 0 4px 15px rgba(0,0,0,0.08); 
    ">
      
      <div style="
        padding: 12px 14px 8px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f1f5f9;
      ">
        <span style="font-size: 11px; font-weight: 600; color: #94a3b8; font-family: monospace;">
          #${property.propertyCode}
        </span>
        <span style="${statusStyle}">
          ${property.status || 'ACTIVE'}
        </span>
      </div>

      <div style="padding: 12px 14px;">
        <h3 style="
          margin: 0 0 10px 0;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.4;
          color: #0f172a;
          height: 38px; /* Force fixed height for 2 lines */
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        ">${propertyName}</h3>

        ${(propertyTypeName || hasDirectValuation || hasDirectIndicativeValuation) ? `
          <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
            ${propertyTypeName ? `
              <span style="
                font-size: 10px;
                font-weight: 700;
                color: #0f172a;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                padding: 2px 6px;
                border-radius: 6px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
              ">
                <span style="display: inline-flex; color: #0f172a;">
                  ${getPropertyTypeIconSvg(propertyTypeName, { size: 12 })}
                </span>
                ${propertyTypeName}
              </span>
            ` : ''}
            ${hasDirectValuation ? `
              <span style="
                font-size: 10px;
                font-weight: 700;
                color: #92400e;
                background: #fef3c7;
                border: 1px solid #fcd34d;
                padding: 2px 6px;
                border-radius: 6px;
              ">Valuation</span>
            ` : ''}
            ${hasDirectIndicativeValuation ? `
              <span style="
                font-size: 10px;
                font-weight: 700;
                color: #b91c1c;
                background: #fef2f2;
                border: 1px solid #fecaca;
                padding: 2px 6px;
                border-radius: 6px;
              ">Indicative</span>
            ` : ''}
          </div>
        ` : ''}

        <div style="
          display: grid; 
          grid-template-columns: 1.2fr 0.8fr; 
          gap: 12px; 
          margin-bottom: 10px;
          align-items: end;
        ">
          <div>
            ${latestTransaction ? `
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Total Price</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1;">
                ${formatCurrency(latestTransaction.totalPrice)}
              </div>
            ` : hasValuationPrice ? `
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Market Value</div>
              <div style="font-size: 18px; font-weight: 800; color: #0f172a; line-height: 1;">
                ${formatCurrency(marketValue as number)}
              </div>
              ${hasForcedSale ? `
                <div style="margin-top: 4px; font-size: 10px; color: #b45309; font-weight: 600;">
                  Forced Sale: ${formatCurrency(forcedSaleValue as number)}
                </div>
              ` : ''}
            ` : hasIndicativeRange ? `
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Indicative Range</div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">
                ${indicativeRange}
              </div>
              ${hasIndicativeForcedSale ? `
                <div style="margin-top: 4px; font-size: 10px; color: #b91c1c; font-weight: 600;">
                  Forced Sale: ${formatCurrency(indicativeForcedSaleValue as number)}
                </div>
              ` : ''}
            ` : `
              <div style="font-size: 14px; color: #94a3b8; font-style: italic;">No Price</div>
            `}
          </div>

          <div>
             ${hasTitleDeedSize ? `
              <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">Land Size</div>
              <div style="font-size: 14px; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/></svg>
                ${formatNumber(titleDeedSize)}m²
              </div>
             ` : ''}
          </div>
        </div>

        ${latestTransaction ? `
          <div style="
            display: flex; 
            align-items: center; 
            gap: 8px; 
            margin-bottom: 12px; 
            padding-bottom: 10px;
            border-bottom: 1px solid #f1f5f9;
          ">
            <span style="font-size: 10px; font-weight: 700; color: #2563eb; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
              ${latestTransaction.transactionType}
            </span>
            <span style="font-size: 12px; color: #2bda2bff; font-weight: 600;">
               • ${formatDate(latestTransaction.transactionDate)}
            </span>
             <span style="font-size: 12px; color: #2bda2bff; font-weight: 600;">
               • $${latestTransaction.pricePerSqm}/m²
            </span>
          </div>
        ` : latestValuation ? `
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f1f5f9;
          ">
            <span style="font-size: 10px; font-weight: 700; color: #b45309; background: #fffbeb; padding: 2px 6px; border-radius: 4px;">
              Valuation
            </span>
            ${latestValuation.valuationDate ? `
              <span style="font-size: 12px; color: #b45309; font-weight: 600;">
                • ${formatDate(latestValuation.valuationDate)}
              </span>
            ` : ''}
            ${valuationPricePerSqm ? `
              <span style="font-size: 12px; color: #b45309; font-weight: 600;">
                • ${formatCurrency(valuationPricePerSqm as number)}/m²
              </span>
            ` : ''}
          </div>
        ` : latestIndicativeValuation ? `
          <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding-bottom: 10px;
            border-bottom: 1px solid #f1f5f9;
          ">
            <span style="font-size: 10px; font-weight: 700; color: #b91c1c; background: #fef2f2; padding: 2px 6px; border-radius: 4px;">
              Indicative
            </span>
            ${latestIndicativeValuation.indicationDate ? `
              <span style="font-size: 12px; color: #b91c1c; font-weight: 600;">
                • ${formatDate(latestIndicativeValuation.indicationDate)}
              </span>
            ` : ''}
          </div>
        ` : '<div style="margin-bottom: 10px; border-bottom: 1px solid #f1f5f9;"></div>'}

        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span style="
            font-size: 11px; 
            color: #475569; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            max-width: 240px;
          " title="${locationText}">${locationText}</span>
        </div>

        <div style="display: flex; gap: 8px;">
          ${latestValuation ? `
          <a
            href="${valuationLink}"
            style="
              flex: 1;
              background: #f59e0b;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 8px 0;
              font-size: 12px;
              font-weight: 600;
              text-align: center;
              text-decoration: none;
              font-family: ${fontStack};
            "
            onmouseover="this.style.background='#d97706'"
            onmouseout="this.style.background='#f59e0b'"
          >
            View Valuation
          </a>
          ` : latestIndicativeValuation ? `
          <a
            href="${indicativeValuationLink}"
            style="
              flex: 1;
              background: #dc2626;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 8px 0;
              font-size: 12px;
              font-weight: 600;
              text-align: center;
              text-decoration: none;
              font-family: ${fontStack};
            "
            onmouseover="this.style.background='#b91c1c'"
            onmouseout="this.style.background='#dc2626'"
          >
            View Indicative
          </a>
          ` : `
          <button
            onclick="${onViewDetails}"
            style="
              flex: 1;
              background: #0f172a;
              color: white;
              border: none;
              border-radius: 6px;
              padding: 8px 0;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: background 0.2s;
              font-family: ${fontStack};
            "
            onmouseover="this.style.background='#334155'"
            onmouseout="this.style.background='#0f172a'"
          >
            View Details
          </button>
          `}

          ${!latestValuation && !latestIndicativeValuation && property.googleMapLink ? `
          <a
            href="${property.googleMapLink}"
            target="_blank"
            rel="noopener noreferrer"
            style="
              width: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              color: #64748b;
              background: #fff;
            "
            onmouseover="this.style.background='#f8fafc'; this.style.color='#0f172a'"
            onmouseout="this.style.background='#fff'; this.style.color='#64748b'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          </a>
          ` : ''}

          <a
            href="${streetViewLink}"
            target="_blank"
            rel="noopener noreferrer"
            title="Open Street View"
            style="
              width: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              border: 1px solid #bae6fd;
              border-radius: 6px;
              color: #0f766e;
              background: #ecfeff;
              text-decoration: none;
            "
            onmouseover="this.style.background='#cffafe'; this.style.color='#115e59'"
            onmouseout="this.style.background='#ecfeff'; this.style.color='#0f766e'"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12a7 7 0 1 1 14 0"></path>
              <path d="M12 12h.01"></path>
              <path d="M8.5 16a5.5 5.5 0 0 0 7 0"></path>
              <path d="M6 18h12"></path>
            </svg>
          </a>
        </div>

      </div>
    </div>
  `;
}

/**
 * Helper to ensure Markers don't look blurry
 */
type MarkerColors = { fill: string; stroke: string };

const markerColors: Record<string, MarkerColors> = {
  ACTIVE: { fill: "#10b981", stroke: "#ffffff" },
  INACTIVE: { fill: "#94a3b8", stroke: "#ffffff" },
  SOLD: { fill: "#3b82f6", stroke: "#ffffff" },
  RENTED: { fill: "#f59e0b", stroke: "#ffffff" },
};

const getMarkerColors = (status: string): MarkerColors => {
  const statusUpper = status?.toUpperCase() || "ACTIVE";
  return markerColors[statusUpper] || markerColors.ACTIVE;
};

const buildPropertyTypeSvg = (content: string, size?: number): string => {
  const sizeAttrs = size ? ` width="${size}" height="${size}"` : "";
  return `<svg${sizeAttrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${content}
  </svg>`;
};

export const getPropertyTypeIconSvg = (
  typeName?: string,
  options?: { size?: number }
): string => {
  const name = (typeName || "").toLowerCase();
  const size = options?.size;

  if (name.includes("agricultural")) {
    return buildPropertyTypeSvg(`
      <path d="M11 21c6-2 9-7 9-13C14 7 8 3 3 3c1 6 4 12 8 14z"></path>
      <path d="M7 14c2 1 4 3 6 7"></path>
    `, size);
  }

  if (name.includes("land")) {
    return buildPropertyTypeSvg(`
      <rect x="3" y="3" width="18" height="18" rx="2"></rect>
      <path d="M3 9h18"></path>
      <path d="M9 21V9"></path>
    `, size);
  }

  if (name.includes("commercial")) {
    return buildPropertyTypeSvg(`
      <path d="M3 9l2-6h14l2 6"></path>
      <path d="M4 9v10h16V9"></path>
      <path d="M9 19V13h6v6"></path>
    `, size);
  }

  if (name.includes("industrial")) {
    return buildPropertyTypeSvg(`
      <path d="M3 20V9l5 3V9l5 3V9l8-4v15H3z"></path>
      <path d="M7 20V14"></path>
      <path d="M11 20V15"></path>
      <path d="M15 20V16"></path>
    `, size);
  }

  if (name.includes("residential")) {
    return buildPropertyTypeSvg(`
      <path d="M3 11l9-7 9 7"></path>
      <path d="M5 10v10h14V10"></path>
    `, size);
  }

  if (name.includes("building")) {
    return buildPropertyTypeSvg(`
      <rect x="4" y="3" width="16" height="18" rx="2"></rect>
      <path d="M8 7h2"></path>
      <path d="M8 11h2"></path>
      <path d="M8 15h2"></path>
      <path d="M14 7h2"></path>
      <path d="M14 11h2"></path>
      <path d="M14 15h2"></path>
    `, size);
  }

  if (name.includes("property") || !name) {
    return buildPropertyTypeSvg(`
      <path d="M3 11l9-7 9 7"></path>
      <path d="M5 10v10h14V10"></path>
    `, size);
  }

  return buildPropertyTypeSvg(`
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4"></path>
    <path d="M12 17h.01"></path>
  `, size);
};

const createMarkerGlyphElement = (typeName?: string): HTMLElement | undefined => {
  if (typeof document === "undefined") return undefined;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = getPropertyTypeIconSvg(typeName);
  const svg = wrapper.firstElementChild as SVGElement | null;
  if (!svg) return undefined;
  svg.setAttribute("width", "14");
  svg.setAttribute("height", "14");
  svg.style.color = "#ffffff";
  return svg as unknown as HTMLElement;
};

export function getMarkerIcon(status: string): google.maps.Symbol {
  const color = getMarkerColors(status);

  return {
    path:
      "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
    fillColor: color.fill,
    fillOpacity: 1,
    strokeColor: color.stroke,
    strokeWeight: 2, // Slightly thinner stroke for crispness
    scale: 1.5, // Slightly smaller scale
    anchor: new google.maps.Point(12, 22),
  };
}

export function createPropertyMarkerContent(property: PropertyLocationMarker): {
  element: HTMLElement;
  isCard: boolean;
} {
  const imageUrl = property.propertyPhotos?.frontSide || property.frontSide || "";
  const latestTransaction = property.transaction && property.transaction.length > 0
    ? property.transaction[0]
    : null;
  const priceText = latestTransaction ? formatCurrency(latestTransaction.totalPrice) : "Price N/A";
  const titleText = property.propertyName || "Property";
  const locationText = property.formattedAddress || "Unknown location";

  if (typeof document === "undefined") {
    const fallback = { element: {} as HTMLElement, isCard: false };
    return fallback;
  }

  if (!imageUrl) {
    const fallback = document.createElement("div");
    fallback.style.cssText =
      "background:#0f172a;color:#fff;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:700;white-space:nowrap;";
    fallback.textContent = titleText.slice(0, 18);
    return { element: fallback, isCard: false };
  }

  const container = document.createElement("div");
  container.dataset.markerType = "property-card";
  container.style.cssText =
    "width:220px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.18);border:1px solid #e2e8f0;transform:translateY(-12px);transition:transform 0.2s ease, box-shadow 0.2s ease;";

  container.innerHTML = `
    <div style="display:flex;gap:0;">
      <div style="width:88px;height:72px;overflow:hidden;background:#e2e8f0;flex-shrink:0;">
        <img src="${imageUrl}" alt="Property" style="width:100%;height:100%;object-fit:cover;display:block;" />
      </div>
      <div style="padding:8px 10px;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:#0f172a;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${titleText}
        </div>
        <div style="margin-top:4px;font-size:11px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${locationText}
        </div>
        <div style="margin-top:6px;font-size:13px;font-weight:800;color:#0f172a;">
          ${priceText}
        </div>
      </div>
    </div>
  `;

  return { element: container, isCard: true };
}

export function getAdvancedMarkerPin(
  status: string,
  scale = 1,
  options?: {
    hasValuation?: boolean;
    hasIndicativeValuation?: boolean;
    propertyTypeName?: string;
  }
): google.maps.marker.PinElement {
  const color = getMarkerColors(status);
  const hasValuation = !!options?.hasValuation;
  const hasIndicativeValuation = !!options?.hasIndicativeValuation;
  const glyphName = options?.propertyTypeName || "Property";
  const glyphElement = createMarkerGlyphElement(glyphName);
  const primaryBlue = "#2563eb";
  const valuationOrange = "#f59e0b";
  const indicativeDanger = "#dc2626";
  const indicativeDangerBorder = "#b91c1c";

  const background = hasValuation
    ? valuationOrange
    : hasIndicativeValuation
      ? indicativeDanger
      : primaryBlue;
  const borderColor = hasValuation
    ? "#fbbf24"
    : hasIndicativeValuation
      ? indicativeDangerBorder
      : color.stroke;

  return new google.maps.marker.PinElement({
    background,
    borderColor,
    glyphColor: "#ffffff",
    glyph: glyphElement,
    scale,
  });
}
/**
 * Fit map bounds with smart zoom limits and smooth animation
 */
export function fitMapToBounds(
  map: google.maps.Map,
  markers: Array<google.maps.Marker | google.maps.marker.AdvancedMarkerElement>
): void {
  if (!map || !markers || markers.length === 0) return;

  const bounds = new google.maps.LatLngBounds();
  let hasValidPosition = false;

  markers.forEach(marker => {
    const position =
      typeof (marker as google.maps.Marker).getPosition === "function"
        ? (marker as google.maps.Marker).getPosition()
        : (marker as google.maps.marker.AdvancedMarkerElement).position;
    if (position) {
      bounds.extend(position as google.maps.LatLng | google.maps.LatLngLiteral);
      hasValidPosition = true;
    }
  });

  if (!hasValidPosition) return;
  
  // Single marker: center and set optimal zoom
  if (markers.length === 1) {
    const position =
      typeof (markers[0] as google.maps.Marker).getPosition === "function"
        ? (markers[0] as google.maps.Marker).getPosition()
        : (markers[0] as google.maps.marker.AdvancedMarkerElement).position;
    if (position) {
      map.panTo(position as google.maps.LatLng | google.maps.LatLngLiteral);
      // Keep a comfortable context view instead of zooming too close.
      map.setZoom(10);
    }
    return;
  } 

  // Multiple markers: fit bounds with generous padding
  map.fitBounds(bounds, { top: 80, right: 80, bottom: 80, left: 80 });

  // Prevent excessive zoom-in for closely clustered markers
  const listener = google.maps.event.addListenerOnce(map, "idle", () => {
    const currentZoom = map.getZoom();
    if (currentZoom && currentZoom > 11) {
      map.setZoom(11);
    }
    google.maps.event.removeListener(listener);
  });
}

/**
 * Add marker hover effects for enhanced interactivity
 */
export function addMarkerHoverEffects(
  marker: google.maps.Marker,
  property: PropertyLocationMarker
): void {
  const originalIcon = marker.getIcon();
  
  marker.addListener('mouseover', () => {
    const hoveredIcon = getMarkerIcon(property.status);
    if (typeof hoveredIcon === 'object') {
      marker.setIcon({
        ...hoveredIcon,
        scale: (hoveredIcon.scale || 1.7) * 1.15,
        strokeWeight: 3.5,
      });
    }
    marker.setZIndex(google.maps.Marker.MAX_ZINDEX + 1);
  });

  marker.addListener('mouseout', () => {
    marker.setIcon(originalIcon);
    marker.setZIndex(undefined);
  });
}

/**
 * Custom map styles for a modern, clean look (optional)
 */
export const modernMapStyles: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ lightness: 15 }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e0f2fe" }]
  }
];

export function convertShapesToGeoJSON(shapes: DrawnShape[]) {
  if (!shapes || shapes.length === 0) return undefined;

  // For now, use the first polygon shape found
  const polygonShape = shapes.find((s) => s.type === 'polygon');

  if (!polygonShape) {
    // If no polygon, try to convert rectangle or circle to polygon
    const rectangleShape = shapes.find((s) => s.type === 'rectangle');
    const circleShape = shapes.find((s) => s.type === 'circle');

    if (rectangleShape && rectangleShape.shape instanceof google.maps.Rectangle) {
      const bounds = rectangleShape.shape.getBounds();
      if (!bounds) return undefined;

      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      // Create polygon from rectangle bounds (clockwise)
      return {
        type: "Polygon",
        coordinates: [
          [
            [sw.lng(), sw.lat()], // SW
            [ne.lng(), sw.lat()], // SE
            [ne.lng(), ne.lat()], // NE
            [sw.lng(), ne.lat()], // NW
            [sw.lng(), sw.lat()], // Close the ring
          ],
        ],
      };
    }

    if (circleShape && circleShape.shape instanceof google.maps.Circle) {
      const center = circleShape.shape.getCenter();
      const radius = circleShape.shape.getRadius();

      if (!center || !radius) return undefined;

      // Convert circle to polygon with 32 points
      const points: number[][] = [];
      const numPoints = 32;

      for (let i = 0; i <= numPoints; i++) {
        const angle = (i * 360) / numPoints;
        const radian = (angle * Math.PI) / 180;

        // Calculate point on circle using haversine
        const latOffset = (radius / 111320) * Math.cos(radian);
        const lngOffset = (radius / (111320 * Math.cos((center.lat() * Math.PI) / 180))) * Math.sin(radian);

        points.push([
          center.lng() + lngOffset,
          center.lat() + latOffset,
        ]);
      }

      return {
        type: "Polygon",
        coordinates: [points],
      };
    }

    return undefined;
  }

  // Extract polygon coordinates
  if (polygonShape.shape instanceof google.maps.Polygon) {
    const path = polygonShape.shape.getPath();
    const coordinates: number[][] = [];

    for (let i = 0; i < path.getLength(); i++) {
      const point = path.getAt(i);
      coordinates.push([point.lng(), point.lat()]);
    }

    // Close the polygon ring if not already closed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];

      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([first[0], first[1]]);
      }
    }

    return {
      type: "Polygon",
      coordinates: [coordinates],
    };
  }

  return undefined;
} 
