// Imports Fleet_Management_Workbook_Design.xlsx into Supabase in the
// exact order required by the Foreign Keys.
//
// Usage:
//   npm install xlsx @supabase/supabase-js --save-dev
//   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx \
//     node scripts/import_excel.mjs ./Fleet_Management_Workbook_Design.xlsx

import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node import_excel.mjs <path-to-workbook.xlsx>");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const IMPORT_ORDER = [
  ["Buses", "buses"], ["Drivers", "drivers"], ["Handover_Log", "handover_log"],
  ["Vehicle_Health_Log", "vehicle_health_log"], ["Contracts", "contracts"], ["Guardians", "guardians"],
  ["Students", "students"], ["Trips", "trips"], ["Payments", "payments"], ["Driver_Payroll", "driver_payroll"],
  ["GPS_Tracking", "gps_tracking"], ["SOS_Alerts", "sos_alerts"], ["Announcements", "announcements"], ["Event_Logs", "event_logs"],
];

function readSheetRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  const rows = xlsx.utils.sheet_to_json(sheet, { range: 1, defval: null });
  return rows.filter((row) => {
    const firstValue = Object.values(row)[0];
    return firstValue !== null && !String(firstValue).match(/^(Text|Number|Date|Boolean|Timestamp)/);
  });
}

async function importSheet(workbook, sheetName, tableName) {
  const rows = readSheetRows(workbook, sheetName);
  if (rows.length === 0) { console.log(`(skip) ${sheetName}: no data rows found`); return; }
  const { error } = await supabase.from(tableName).insert(rows);
  if (error) {
    console.error(`FAILED on ${sheetName} -> ${tableName}:`, error.message);
    process.exit(1);
  }
  console.log(`OK: ${sheetName} -> ${tableName} (${rows.length} rows)`);
}

const workbook = xlsx.readFile(filePath);
for (const [sheetName, tableName] of IMPORT_ORDER) {
  await importSheet(workbook, sheetName, tableName);
}
console.log("Import complete.");
