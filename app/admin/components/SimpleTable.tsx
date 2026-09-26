"use client";

import { useTableKit } from "@/lib/tablekit";

export interface Column {
  key: string;
  label: string;
}

const STATUS_BADGE: Record<string, string> = {
  Active: "badge-active", Confirmed: "badge-active", Paid: "badge-active", Resolved: "badge-active",
  In_Maintenance: "badge-warning", Pending: "badge-warning", Underpaid_Flagged: "badge-warning",
  Inactive: "badge-inactive", Retired: "badge-inactive", Cancelled: "badge-inactive",
  Emergency: "badge-danger", Rejected: "badge-danger",
};

function renderCell(value: any) {
  const str = String(value ?? "—");
  const badgeClass = STATUS_BADGE[str];
  if (badgeClass) {
    return <span className={`badge ${badgeClass}`}><span className="badge-dot" />{str}</span>;
  }
  return str;
}

export default function SimpleTable({
  columns, rows, renderActions,
}: {
  columns: Column[];
  rows: Record<string, any>[];
  renderActions?: (row: Record<string, any>) => React.ReactNode;
}) {
  // Search/filter is a plug-in (lib/tablekit): if it ever fails, tk.rows is simply all the rows.
  const tk = useTableKit(rows, columns);

  if (rows.length === 0) {
    return <p style={{ color: "var(--steel)", fontSize: "0.95rem" }}>لا توجد سجلات بعد.</p>;
  }
  return (
    <>
      {tk.toolbar}
      {tk.rows.length === 0 ? (
        <p style={{ color: "var(--steel)", fontSize: "0.95rem" }}>
          لا توجد نتائج مطابقة. <button type="button" onClick={tk.clear} style={{ background: "none", border: "none", color: "var(--navy)", textDecoration: "underline", cursor: "pointer", fontFamily: "inherit" }}>مسح البحث</button>
        </p>
      ) : (
        <div className="card fade-in" style={{ overflow: "hidden" }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                {renderActions && <th>إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {tk.rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => <td key={c.key}>{renderCell(row[c.key])}</td>)}
                  {renderActions && <td>{renderActions(row)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
