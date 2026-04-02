import { Circle, Edit3, Info, Layers, Pentagon, Square, Trash2, Undo2, Ruler, X } from "lucide-react";
import { DrawnShape, ShapeType } from "@/types/googleMap.types";

type Props = {
  drawingMode: ShapeType;
  setDrawingMode: (m: ShapeType) => void;
  currentPolygonPoints: number;
  onCompletePolygon: () => void;
  onUndo: () => void;
  onClearAll: () => void;
  onRemoveShape: (id: string) => void;
  shapes: DrawnShape[];
  historyCount: number;

  // NEW: manual overrides (meters)
  userLengthM: number | null;
  userHeightM: number | null;

  // NEW: notify parent when user edits
  onChangeUserLengthM: (v: number | null) => void;
  onChangeUserHeightM: (v: number | null) => void;

  // OPTIONAL: persist button
  onSaveDimensions?: () => void;
};

function parseNumberOrNull(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function DrawingPanel(props: Props) {
  const {
    drawingMode,
    setDrawingMode,
    currentPolygonPoints,
    onCompletePolygon,
    onUndo,
    onClearAll,
    onRemoveShape,
    shapes,
    historyCount,

    userLengthM,
    userHeightM,
    onChangeUserLengthM,
    onChangeUserHeightM,
    onSaveDimensions,
  } = props;

  const lengthError = userLengthM != null && userLengthM <= 0;
  const heightError = userHeightM != null && userHeightM <= 0;
  const hasDimError = lengthError || heightError;

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border-2 border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Edit3 className="h-3.5 w-3.5 text-white" />
          </div>
          <h3 className="text-xs font-bold text-gray-900">Drawing Tools</h3>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* Tools */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setDrawingMode(drawingMode === "polygon" ? null : "polygon")}
            className={`px-2 py-3 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
              drawingMode === "polygon"
                ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400"
            }`}
          >
            <Pentagon className="h-5 w-5" />
            <span className="text-[10px]">Polygon</span>
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === "rectangle" ? null : "rectangle")}
            className={`px-2 py-3 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
              drawingMode === "rectangle"
                ? "bg-gradient-to-br from-green-600 to-green-700 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-green-50 border-2 border-gray-200 hover:border-green-400"
            }`}
          >
            <Square className="h-5 w-5" />
            <span className="text-[10px]">Rectangle</span>
          </button>

          <button
            onClick={() => setDrawingMode(drawingMode === "circle" ? null : "circle")}
            className={`px-2 py-3 text-xs font-semibold rounded-xl transition-all flex flex-col items-center gap-1.5 ${
              drawingMode === "circle"
                ? "bg-gradient-to-br from-orange-600 to-orange-700 text-white shadow-lg"
                : "bg-white text-gray-700 hover:bg-orange-50 border-2 border-gray-200 hover:border-orange-400"
            }`}
          >
            <Circle className="h-5 w-5" />
            <span className="text-[10px]">Circle</span>
          </button>
        </div>

        {/* Undo + Complete */}
        <div className="flex gap-2 mt-2">
          {historyCount > 0 && (
            <button
              onClick={onUndo}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 text-purple-700 border-2 border-purple-200 hover:border-purple-400 transition-all flex items-center justify-center gap-1.5"
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
          )}

          {drawingMode === "polygon" && currentPolygonPoints >= 3 && (
            <button
              onClick={onCompletePolygon}
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md flex items-center justify-center gap-1.5"
            >
              Complete
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[9px]">{currentPolygonPoints}</span>
            </button>
          )}
        </div>

        {/* Instructions */}
        {drawingMode && (
          <div className="mt-2 p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-[11px] text-gray-700 space-y-1">
                {drawingMode === "polygon" && <div>Click map to add vertices. Enter to complete.</div>}
                {drawingMode === "rectangle" && <div>Click corner 1 then corner 2.</div>}
                {drawingMode === "circle" && <div>Click center then edge.</div>}
                <div className="text-[10px] text-red-700 font-mono">Esc = Cancel</div>
              </div>
            </div>
          </div>
        )}

        {/* NEW: Manual dimensions */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border-2 border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-gray-700" />
              <div className="text-xs font-bold text-gray-800">Manual Dimensions</div>
            </div>

            {(userLengthM != null || userHeightM != null) && (
              <button
                type="button"
                onClick={() => {
                  onChangeUserLengthM(null);
                  onChangeUserHeightM(null);
                }}
                className="text-[11px] font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-white border border-transparent hover:border-gray-200"
                title="Clear manual dimensions"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-700">Length (m)</div>
              <input
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                value={userLengthM ?? ""}
                onChange={(e) => onChangeUserLengthM(parseNumberOrNull(e.target.value))}
                className={`w-full px-2 py-2 text-xs rounded-lg border-2 bg-white outline-none ${
                  lengthError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-blue-400"
                }`}
                placeholder="e.g. 55"
              />
              {lengthError && <div className="text-[10px] text-red-600">Must be &gt; 0</div>}
            </label>

            <label className="space-y-1">
              <div className="text-[11px] font-semibold text-gray-700">Height (m)</div>
              <input
                inputMode="decimal"
                type="number"
                min={0}
                step="0.01"
                value={userHeightM ?? ""}
                onChange={(e) => onChangeUserHeightM(parseNumberOrNull(e.target.value))}
                className={`w-full px-2 py-2 text-xs rounded-lg border-2 bg-white outline-none ${
                  heightError ? "border-red-400 focus:border-red-500" : "border-gray-200 focus:border-blue-400"
                }`}
                placeholder="e.g. 25"
              />
              {heightError && <div className="text-[10px] text-red-600">Must be &gt; 0</div>}
            </label>
          </div>

          {onSaveDimensions && (
            <button
              type="button"
              disabled={hasDimError}
              onClick={onSaveDimensions}
              className={`mt-2 w-full px-3 py-2 text-xs font-semibold rounded-lg transition-all border-2 ${
                hasDimError
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-gradient-to-r from-blue-600 to-blue-700 text-white border-blue-700 shadow-md"
              }`}
            >
              Save Dimensions
            </button>
          )}

          <div className="mt-2 text-[10px] text-gray-600">
            These values are overrides (notes). They do not change the polygon.
          </div>
        </div>

        {/* Shapes list */}
        {shapes.length > 0 && (
          <div className="mt-3 pt-3 border-t-2 border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-600" />
                <span className="text-xs font-bold text-gray-700">My Shapes</span>
              </div>
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                {shapes.length}
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1.5 mb-2">
              {shapes.map((shape, idx) => (
                <div
                  key={shape.id}
                  className="group flex items-center justify-between px-2.5 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-all"
                >
                  <div className="text-[11px] font-semibold text-gray-700 capitalize">
                    {shape.type} #{idx + 1}
                  </div>
                  <button
                    onClick={() => onRemoveShape(shape.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-50 rounded transition-all"
                    title="Remove shape"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={onClearAll}
              className="w-full px-3 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-2 border-red-200 hover:border-red-400 transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Clear All Shapes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
