"use client";

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

export default function SimpleTable({ columns, rows }: { columns: Column[]; rows: Record<string, any>[] }) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--steel)", fontSize: "0.95rem" }}>لا توجد سجلات بعد.</p>;
  }
  return (
    <div className="card fade-in" style={{ overflow: "hidden" }}>
      <table className="data-table">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>{columns.map((c) => <td key={c.key}>{renderCell(row[c.key])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
