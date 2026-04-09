"use client";

import { isValidElement, useEffect, useMemo, useState } from "react";
import {
  Search,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  X,
  SlidersHorizontal,
  Filter,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTableConfig, ApiParams } from "./types";
import { useTranslations } from "next-intl";

type DataRow = { id?: number | string };

interface DataTableProps<T extends DataRow> {
  config: DataTableConfig<T>;
  useDataHook: (params: ApiParams) => {
    data: unknown;
    isLoading: boolean;
    isError: boolean;
    error: unknown;
    refetch?: () => void | Promise<unknown>;
  };
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  canEdit?: (item: T) => boolean;
  canDelete?: (item: T) => boolean;
  headerActions?: React.ReactNode;
  onFilterChange?: (filterKey: string, value: string) => void;
  onParamsChange?: (params: ApiParams) => void;
  onRowClick?: (item: T) => void;
  isRowClickable?: (item: T) => boolean;
  rowClassName?: (item: T) => string;
  customRowActions?: (item: T) => React.ReactNode;
}

const toDateBoundary = (value: string, boundary: "start" | "end") => {
  if (!value) return undefined;

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return undefined;

  if (boundary === "end") {
    parsed.setHours(23, 59, 59, 999);
  } else {
    parsed.setHours(0, 0, 0, 0);
  }

  return parsed;
};

export function DataTable<T extends DataRow>({
  config,
  useDataHook,
  onView,
  onEdit,
  onDelete,
  canEdit = () => true,
  canDelete = () => true,
  headerActions,
  onFilterChange,
  onParamsChange,
  onRowClick,
  isRowClickable = () => true,
  rowClassName,
  customRowActions,
}: DataTableProps<T>) {
  const t = useTranslations("dataTable");

  const safeNode = (
    value: unknown,
    fallback: React.ReactNode = null
  ): React.ReactNode => {
    if (value === null || value === undefined || value === false) return fallback;
    if (typeof value === "function") return fallback;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      isValidElement(value)
    ) {
      return value as React.ReactNode;
    }
    return fallback;
  };

  const safeText = (value: unknown, fallback = ""): string => {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return fallback;
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(config.defaultPageSize || 10);
  const [sortBy, setSortBy] = useState(config.defaultSortBy || "id");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    config.defaultSortOrder || "asc"
  );

  // Initialize filters from default values
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    config.filters?.forEach((f) => {
      if (f.defaultValue !== undefined && f.defaultValue !== null) {
        initial[f.key] = String(f.defaultValue);
      }
    });
    return initial;
  });

  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  // Keep filters collapsed by default on first page load/navigation.
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >(() => {
    const initial: Record<string, boolean> = {};
    config.columns.forEach((col) => {
      initial[String(col.key)] = true;
    });
    return initial;
  });

  // --- Logic ---

 const handleFilterChange = (key: string, value: string) => {
  const normalized = value === "All" ? "" : value;

  // compute dependent keys to clear
  const dependentKeys =
    config.filters
      ?.filter((f) => f.dependsOn === key)
      .map((f) => f.key) ?? [];

  // 1) update local filters only (NO side effects inside updater)
  setFilters((prev) => {
    const next = { ...prev };

    if (!normalized) delete next[key];
    else next[key] = normalized;

    // clear dependents locally
    dependentKeys.forEach((k) => delete next[k]);

    return next;
  });

  // 2) notify parent AFTER local state update call (side effects here are fine)
  onFilterChange?.(key, normalized);

  // clear dependent filters in parent
  dependentKeys.forEach((k) => onFilterChange?.(k, ""));

  setCurrentPage(1);
};


  const handleNumberFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev };
      if (!value || value === "") delete newFilters[key];
      else newFilters[key] = value;
      return newFilters;
    });
    setCurrentPage(1);
  };

  const clearFilters = () => {
  setFilters({});
  setSearchTerm("");
  setDateRange({ from: "", to: "" });
  setCurrentPage(1);

  queueMicrotask(() => {
    config.filters?.forEach((f) => onFilterChange?.(f.key, ""));
  });
};


  const apiParams = useMemo(() => {
    const params: ApiParams = {
      page: currentPage,
      limit: pageSize,
      sortBy,
      sortOrder,
      ...(searchTerm && { search: searchTerm }),
    };

    Object.entries(filters).forEach(([key, value]) => {
  if (!value || value === "All") return;

  // ✅ Keep admin codes as strings
  const stringCodeKeys = ["provinceId", "districtId", "communeId", "villageId"];
  if (stringCodeKeys.includes(key)) {
    params[key] = String(value);
    return;
  }

  // ✅ Only these should be numbers
  const numericKeys = ["minPrice", "maxPrice", "minLandArea", "maxLandArea", "minMarketValue", "maxMarketValue", "propertyTypeId", "valuerId"];
  if (numericKeys.includes(key)) {
    const num = Number(value);
    params[key] = Number.isNaN(num) ? value : num;
    return;
  }

  params[key] = value;
});


    const createdAfter = toDateBoundary(dateRange.from, "start");
    const createdBefore = toDateBoundary(dateRange.to, "end");

    if (createdAfter) params.createdAfter = createdAfter;
    if (createdBefore) params.createdBefore = createdBefore;
    if (config.forcedParams) {
      Object.entries(config.forcedParams).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        params[key] = value;
      });
    }

    return params;
  }, [
    currentPage,
    pageSize,
    sortBy,
    sortOrder,
    searchTerm,
    filters,
    dateRange,
    config.forcedParams,
  ]);

  useEffect(() => {
    onParamsChange?.(apiParams);
  }, [apiParams, onParamsChange]);

  const { data, isLoading, isError, error, refetch } = useDataHook(apiParams);

  // Robustly handle data source
  const responseData = data as {
    data?: T[];
    properties?: T[];
    users?: T[];
    valuations?: T[];
    pagination?: { totalPages?: number; total?: number };
  } | null;
  const items =
    (responseData?.data ??
      responseData?.properties ??
      responseData?.users ??
      responseData?.valuations ??
      []) as T[];
  const totalPages = responseData?.pagination?.totalPages || 1;
  const totalItems = responseData?.pagination?.total || 0;

  const activeFiltersCount = Object.keys(filters).length + (dateRange.from || dateRange.to ? 1 : 0);
  const errorObj = error as {
    status?: number;
    message?: string;
    data?: { message?: string };
    response?: { status?: number; data?: { message?: string } };
  } | null;
  const errorStatus = errorObj?.status ?? errorObj?.response?.status;
  const errorMessage =
    errorObj?.response?.data?.message ||
    errorObj?.data?.message ||
    (typeof errorObj?.message === "string" ? errorObj.message : "");
  const isAccessError = errorStatus === 401 || errorStatus === 403;

  const handleSort = (columnKey: string) => {
    if (sortBy === columnKey) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(columnKey);
      setSortOrder("asc");
    }
  };

  // Helper to safely get ID
  const getItemId = (item: T) => {
    const row = item as Record<string, unknown>;
    const candidate = item.id ?? row.propertyId ?? row.userId;
    return typeof candidate === "string" || typeof candidate === "number"
      ? candidate
      : "";
  };

  const toggleAllRows = () => {
    if (selectedRows.size === items.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(items.map((i) => getItemId(i))));
  };

  const toggleRowSelection = (id: string | number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const visibleColumns = config.columns.filter(
    (col) => columnVisibility[String(col.key)]
  );

  return (
    <div className="space-y-4">
      {/* 1. Header & Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">{safeNode(config.title)}</h2>
          <p className="text-sm text-muted-foreground">{safeNode(config.description)}</p>
        </div>
        {safeNode(headerActions)}
      </div>

      <div className="flex flex-col gap-4 bg-card rounded-lg border p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={safeText(config.searchPlaceholder, t("searchPlaceholder"))}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="pl-9"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="mr-2 h-4 w-4" />
              {t("filters")}
              {activeFiltersCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-background text-foreground rounded-full text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t("columns")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuSeparator />
                {config.columns.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={String(column.key)}
                    checked={columnVisibility[String(column.key)]}
                    onCheckedChange={(val) =>
                      setColumnVisibility((prev) => ({ ...prev, [String(column.key)]: val }))
                    }
                  >
                    {safeNode(column.label)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="pt-4 border-t animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {config.filters?.map((filter) => (
                <div key={filter.key} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {safeNode(filter.label)}
                  </label>
                  {filter.type === "select" ? (
                    <Select
                      value={filters[filter.key] || "All"}
                      onValueChange={(v) => handleFilterChange(filter.key, v)}
                      // Disable dependent filter only if parent is empty
                      disabled={!!filter.dependsOn && !filters[filter.dependsOn]}
                    >
                      <SelectTrigger className="h-9 w-full bg-background">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      {/* ✅ FIX: No internal filtering. Trust the parent's options array. */}
                      <SelectContent>
                        <SelectItem value="All">{t("allFilter", { label: safeText(filter.label) })}</SelectItem>
                        {filter.options?.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {safeNode(opt.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : filter.type === "daterange" ? (
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        className="h-9 bg-background"
                        value={dateRange.from}
                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} 
                      />
                      <Input 
                        type="date" 
                        className="h-9 bg-background"
                        value={dateRange.to}
                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} 
                      />
                    </div>
                  ) : (
                    <Input
                      type={filter.type === "number" ? "number" : "text"}
                      placeholder={safeText(filter.placeholder)}
                      value={filters[filter.key] || ""}
                      onChange={(e) => filter.type === "number" 
                        ? handleNumberFilterChange(filter.key, e.target.value) 
                        : handleFilterChange(filter.key, e.target.value)
                      }
                      className="h-9 bg-background"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-4">
               <Button variant="ghost" size="sm" onClick={clearFilters} className="text-destructive hover:bg-destructive/10">
                  {t("clearAll")}
               </Button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Table */}
      <div className="rounded-md border bg-card overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={items.length > 0 && selectedRows.size === items.length}
                  onCheckedChange={toggleAllRows}
                />
              </TableHead>
              {visibleColumns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={col.sortable ? "cursor-pointer select-none" : ""}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <div className="flex items-center gap-2">
                    {safeNode(col.label)}
                    {col.sortable && sortBy === col.key && (
                      sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    )}
                  </div>
                </TableHead>
              ))}
              {(onView || onEdit || onDelete) && <TableHead className="text-right">{t("actions")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    {t("loadingData")}
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="h-40 px-6">
                  <div className="mx-auto max-w-md rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
                      <div className="flex-1 space-y-1 text-left">
                        <p className="text-sm font-semibold text-destructive">
                          {isAccessError ? "Access Denied":"Error Loading Data"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {errorMessage || t("unknownError")}
                        </p>
                        {refetch ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            onClick={() => void refetch()}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="h-32 text-center text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const id = getItemId(item);
                return (
                  <TableRow 
                    key={id} 
                    data-state={selectedRows.has(id) && "selected"}
                    className={rowClassName ? rowClassName(item) : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedRows.has(id)}
                        onCheckedChange={() => toggleRowSelection(id)}
                      />
                    </TableCell>
                    {visibleColumns.map((col) => (
                      <TableCell
                        key={String(col.key)}
                        onClick={(e) => {
                          // Prevent row click if clicking interactive elements
                          if ((e.target as HTMLElement).closest("button, a, input")) return;
                          if (isRowClickable && !isRowClickable(item)) return;
                          if (onRowClick) onRowClick(item);
                        }}
                        className={onRowClick ? "cursor-pointer" : ""}
                      >
                        {safeNode(
                          col.render
                            ? col.render(item[col.key as keyof T], item)
                            : String(item[col.key as keyof T] || ""),
                          "-"
                        )}
                      </TableCell>
                    ))}
                    {(onView || onEdit || onDelete || customRowActions) && (
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onView && <DropdownMenuItem onClick={() => onView(item)}>{t("viewDetails")}</DropdownMenuItem>}
            {onEdit && canEdit(item) && <DropdownMenuItem onClick={() => onEdit(item)}>{t("edit")}</DropdownMenuItem>}
            {customRowActions ? safeNode(customRowActions(item)) : null}
            {(onView || onEdit || customRowActions) && onDelete && canDelete(item) && <DropdownMenuSeparator />}
            {onDelete && canDelete(item) && (
              <DropdownMenuItem onClick={() => onDelete(item)} className="text-destructive">
                {t("delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      {/* 3. Improved Pagination Footer */}
      <div className="flex items-center justify-between px-2 py-4 border-t bg-muted/10 rounded-b-lg">
        <div className="flex-1 text-sm text-muted-foreground">
          {selectedRows.size > 0 ? (
            <span className="font-medium text-primary">{selectedRows.size} selected</span>
          ) : (
             <span>
               Showing {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-
               {Math.min(currentPage * pageSize, totalItems)} of {totalItems}
             </span>
          )}
        </div>
        <div className="flex items-center space-x-4 lg:space-x-6">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium hidden sm:block">{t("rowsPerPage")}</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px] bg-background">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent side="top">
                {[5,10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
             Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
