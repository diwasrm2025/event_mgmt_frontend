"use client";

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChevronLeft,
  faChevronRight,
  faAngleDoubleLeft,
  faAngleDoubleRight,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";

export type PaginationProps<T> = {
  data: T[];
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  children: (paginatedData: T[], totalCount: number) => React.ReactNode;
};

export function DataTablePagination<T>({
  data,
  searchFields,
  searchPlaceholder = "Search records...",
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  children,
}: PaginationProps<T>) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Filter data based on search term across specified search fields
  const filteredData = useMemo(() => {
    if (!search.trim() || !searchFields || searchFields.length === 0) {
      return data;
    }
    const q = search.toLowerCase().trim();
    return data.filter((item) =>
      searchFields.some((field) => {
        const val = item[field];
        if (val === null || val === undefined) return false;
        if (typeof val === "object") {
          return JSON.stringify(val).toLowerCase().includes(q);
        }
        return String(val).toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchFields]);

  // Pagination bounds
  const totalItems = filteredData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const startEntry = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endEntry = Math.min(totalItems, currentPage * pageSize);

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Table Control Header: Search Input + Page Size Selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        {searchFields && searchFields.length > 0 ? (
          <div className="field-with-icon" style={{ flex: "1", minWidth: "220px", maxWidth: "360px" }}>
            <FontAwesomeIcon icon={faMagnifyingGlass} className="field-icon" style={{ opacity: 0.6 }} />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              style={{
                paddingLeft: "36px",
                paddingTop: "8px",
                paddingBottom: "8px",
                borderRadius: "8px",
                fontSize: "0.85rem",
              }}
            />
          </div>
        ) : <div />}

        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.85rem" }}>
          <span className="hint">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="input-select"
            style={{ width: "70px", padding: "6px 8px", fontSize: "0.85rem" }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Render Table Content */}
      {children(paginatedData, totalItems)}

      {/* Table Pagination Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
          fontSize: "0.85rem",
        }}
      >
        <div className="hint">
          Showing <strong>{startEntry}</strong> to <strong>{endEntry}</strong> of <strong>{totalItems}</strong> entries
          {search.trim() ? ` (filtered from ${data.length} total)` : ""}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            title="First Page"
          >
            <FontAwesomeIcon icon={faAngleDoubleLeft} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            title="Previous Page"
          >
            <FontAwesomeIcon icon={faChevronLeft} /> Prev
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} style={{ display: "inline-flex", alignItems: "center" }}>
                    {showEllipsis ? <span className="hint" style={{ padding: "0 4px" }}>...</span> : null}
                    <button
                      type="button"
                      className={`btn btn-xs ${currentPage === p ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => goToPage(p)}
                      style={{ minWidth: "28px", height: "28px" }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Next Page"
          >
            Next <FontAwesomeIcon icon={faChevronRight} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
          >
            <FontAwesomeIcon icon={faAngleDoubleRight} />
          </button>
        </div>
      </div>
    </div>
  );
}
