import React, { useState, useMemo } from "react";
import { useReactTable, flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel } from "@tanstack/table-core";
import * as XLSX from "xlsx"; // For reading Excel files
//import ExcelJS from "exceljs"; // For Excel export with styling CHECK IF NEEDED
//import { saveAs } from "file-saver"; // For triggering file downloads CHECK IF NEEDED
import ReactSelect from "react-select"; // For multi-select dropdowns in filters
import makeAnimated from "react-select/animated";

const animatedComponents = makeAnimated(); // Animated components for ReactSelect

// -------------------- Helpers --------------------

function groupByRecoKey(arr) {
  const group = new Map();
  arr.forEach((item) => {
    const key = item.recoKey;
    if (!group.has(key)) {
      group.set(key, { ...item });
    } else {
      const existing = group.get(key);
      existing.Taxable_Value += toNum(item.Taxable_Value);
      existing.IGST += toNum(item.IGST);
      existing.CGST += toNum(item.CGST);
      existing.SGST += toNum(item.SGST);
      existing.Cess += toNum(item.Cess);
    }
  });
  return Array.from(group.values());
}

const normalizeInvoiceNo = (invNo) => {
  if (!invNo) return "";
  let str = invNo.toString().toUpperCase().trim();
  str = str.replace(/^(HSE|PR)0*/, "");
  const fyPatterns = [
    /\b\d{2}[-/]\d{2}\b/g,
    /\b20\d{2}[-/]20\d{2}\b/g,
    /\b20\d{2}[-/]\d{2}\b/g,
  ];
  fyPatterns.forEach((pat) => {
    str = str.replace(pat, "");
  });
  str = str.replace(/[^0-9]/g, "");
  str = str.replace(/^0+(?=\d)/, "");
  return str;
};

const parseDDMMYYYY = (str) => {
  if (!str) return "";
  const match = str.match(/^(\d{1,2})[.\-/ ](\d{1,2})[.\-/ ](\d{2,4})$/);
  if (match) {
    let dd = parseInt(match[1], 10);
    let mm = parseInt(match[2], 10);
    let yyyy = parseInt(match[3], 10);
    if (yyyy < 100) yyyy += 2000;
    if (mm < 1 || mm > 12) return "";
    const d = new Date(yyyy, mm - 1, dd);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2, "0")}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${d.getFullYear()}`;
    }
  }
  return "";
};

const formatDate = (dateVal) => {
  if (!dateVal) return "";
  if (typeof dateVal === "number") {
    // Excel date number to JS date
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateVal - 2) * 86400000);
    if (!isNaN(date.getTime())) {
      return `${String(date.getDate()).padStart(2, "0")}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${date.getFullYear()}`;
    }
  }
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "";
    return `${String(dateVal.getDate()).padStart(2, "0")}-${String(
      dateVal.getMonth() + 1
    )}-${dateVal.getFullYear()}`;
  }
  if (typeof dateVal === "string") {
    const parsed = parseDDMMYYYY(dateVal);
    if (parsed) return parsed;
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    )}-${d.getFullYear()}`;
  }
  return dateVal;
};

const extractMonthFromInvoiceNo = (invNo) => {
  if (!invNo) return "";
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  let match = invNo.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-./]?(\d{2})/i);
  if (match)
    return `${match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()}-${match[2]}`;
  match = invNo.match(/(\d{1,2})[-./](\d{2})/);
  if (match) {
    const mi = parseInt(match[1], 10) - 1;
    if (mi >= 0 && mi < 12) return `${months[mi]}-${match[2]}`;
  }
  return "";
};

const toNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n;

const renderWithFallback = ({ getValue }) => getValue() || "-";

const renderNumericWithFallback = ({ getValue, column }) => {
  const value = getValue();
  const isDiffColumn = column.id.startsWith("Diff_");
  const displayValue = isDiffColumn ? value : Math.abs(value);
  return displayValue === 0 ? "-" : fmt(displayValue);
};

const createOptions = (values) =>
  values
    .filter((v) => v !== undefined && v !== null)
    .sort()
    .map((v) => ({ label: v === "" ? "(Blank)" : v, value: v }));

function MultiSelectFilter({ column, table }) {
  const uniqueValues = useMemo(() => {
    const u = new Set();
    table.options.data.forEach((row) => u.add(row[column.id] ?? ""));
    return Array.from(u).sort();
  }, [column.id, table.options.data]);

  const values = column.getFilterValue() || [];
  return (
    <ReactSelect
      options={createOptions(uniqueValues)}
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      components={animatedComponents}
      value={createOptions(uniqueValues).filter((o) =>
        values.includes(o.value)
      )}
      onChange={(opts) => column.setFilterValue(opts ? opts.map((o) => o.value) : [])}
      placeholder="Filter..."
      className="mt-1"
      styles={{ menu: (p) => ({ ...p, zIndex: 9999 }) }}
    />
  );
}

const monthToNumber = (m) => {
  if (!m) return null;
  const months = {
    Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
    Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
  };
  const [mon, yr] = m.split("-");
  if (!months[mon] || !yr) return null;
  const year = 2000 + parseInt(yr, 10);
  return year * 100 + months[mon];
};

function getThreeBStatus(status, month, prevMonth) {
  if (!status || !month || !prevMonth) return "";
  const mNum = monthToNumber(month);
  const pNum = monthToNumber(prevMonth);
  if (mNum === null || pNum === null) return "";
  if (status === "Not in 2B") return "";
  if (status === "Not in Books") {
    if (mNum === pNum) return "Claim and Reversed";
    if (mNum < pNum) return `Claim and Reversed in ${month}`;
  }
  if (status === "Matched" || status === "Mismatch") {
    if (mNum === pNum) return "Claimed";
    if (mNum < pNum) return `Claimed now Reversed in ${month}`;
  }
  return "";
}

function getPreviousMonth() {
  const now = new Date();
  now.setDate(1);
  now.setMonth(now.getMonth() - 1);
  const months = [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec",
  ];
  const mm = months[now.getMonth()];
  const yy = String(now.getFullYear()).slice(-2);
  return `${mm}-${yy}`;
}

const getFYFromDate = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return "";
  const dd = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const yyyy = parseInt(parts[2], 10);
  if (
    isNaN(dd) || isNaN(mm) || isNaN(yyyy) ||
    dd < 1 || dd > 31 || mm < 0 || mm > 11 || yyyy < 1900
  ) {
    return "";
  }
  const dateObj = new Date(yyyy, mm, dd);
  if (isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  if (month >= 4) {
    return `FY${year}-${String(year + 1).slice(-2)}`;
  } else {
    return `FY${year - 1}-${String(year).slice(-2)}`;
  }
};

// -------------------- Main Component --------------------

export default function GSTReconciliation() {
  // Data states
  const [data2B, setData2B] = useState([]);
  const [dataBooks, setDataBooks] = useState([]);
  const [reconciledData, setReconciledData] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [file2BStatus, setFile2BStatus] = useState({ message: "", type: "", progress: 0 });
  const [fileBooksStatus, setFileBooksStatus] = useState({ message: "", type: "", progress: 0 });

  // Summary data: total counts and sums for Uploaded Data Summary table
  const summaryData = useMemo(() => {
    const calculateSums = (data) => {
      return data.reduce(
        (acc, item) => {
          acc.docCount += 1;
          acc.taxableValue += toNum(item.Taxable_Value);
          acc.igst += toNum(item.IGST);
          acc.cgst += toNum(item.CGST);
          acc.sgst += toNum(item.SGST);
          acc.cess += toNum(item.Cess);
          return acc;
        },
        { docCount: 0, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
      );
    };
    return {
      twoB: calculateSums(data2B),
      books: calculateSums(dataBooks),
    };
  }, [data2B, dataBooks]);

  // Excel parsing utility
  const parseExcel = (buf) => {
    const wb = XLSX.read(buf, { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" });
  };

  // File upload handler
  const handleFileUpload = (e, setData, setStatus) => {
    const file = e.target.files?.[0];
    if (!file) {
      setStatus({ message: "❌ No file selected", type: "error", progress: 100 });
      return;
    }
    setStatus({ message: `⏳ Processing ${file.name}...`, type: "pending", progress: 50 });

    const r = new FileReader();
    r.onload = (ev) => {
      try {
        setData(parseExcel(ev.target.result));
        setStatus({ message: "✔ File processed successfully!", type: "success", progress: 100 });
      } catch {
        setStatus({ message: "❌ Failed to process file", type: "error", progress: 100 });
      }
    };
    r.readAsArrayBuffer(file);
  };

  // Processing raw data for reconciliation
  const processRawData = (data, source) =>
    data.map((item) => {
      let originalDate = item.Invoice_Date || item.PR_Date || "";
      let dateFormatted = formatDate(originalDate);

      if (source === "2B" && typeof originalDate === "string") {
        const parsed = parseDDMMYYYY(originalDate);
        dateFormatted = parsed || dateFormatted;
      }

      const fy = dateFormatted ? getFYFromDate(dateFormatted) : "";

      return {
        ...item,
        recoKey: `${(item.GSTIN || "").toString().trim().toUpperCase()}__${normalizeInvoiceNo(
          item.Invoice_No || item.PR_No
        )}__${fy}`,
        Taxable_Value: toNum(item.Taxable_Value),
        IGST: toNum(item.IGST),
        CGST: toNum(item.CGST),
        SGST: toNum(item.SGST),
        Cess: toNum(item.Cess),
        Invoice_Date: dateFormatted,
        Invoice_Month_2B:
          source === "2B"
            ? item.Month || item.MONTH || extractMonthFromInvoiceNo(item.Invoice_No)
            : "",
        Invoice_Month_PR: source === "Books" ? item.Month || item.MONTH || "" : "",
        Invoice_FY_2B: source === "2B" ? fy : "",
        Invoice_FY_PR: source === "Books" ? fy : "",
      };
    });

  // Perform reconciliation logic
  const performReconciliation = (books, twoB) => {
    const map = new Map();
    books.forEach((b) => {
      map.set(b.recoKey, {
        GSTIN: b.GSTIN || "",
        Supplier_Name: b.Supplier_Name || "",
        Invoice_Month_PR: b.Invoice_Month_PR || "",
        Invoice_FY_PR: b.Invoice_FY_PR || "",
        Invoice_No_PR: b.Invoice_No || "",
        Invoice_Date_PR: b.Invoice_Date || "",
        Taxable_Value_PR: b.Taxable_Value || 0,
        IGST_PR: b.IGST || 0,
        CGST_PR: b.CGST || 0,
        SGST_PR: b.SGST || 0,
        Cess_PR: b.Cess || 0,
        Invoice_Month_2B: "",
        Invoice_FY_2B: "",
        Invoice_No_2B: "",
        Invoice_Date_2B: "",
        Taxable_Value_2B: 0,
        IGST_2B: 0,
        CGST_2B: 0,
        SGST_2B: 0,
        Cess_2B: 0,
        Status: "Not in 2B",
        ThreeB_Status: "",
      });
    });

    twoB.forEach((a) => {
      const existing = map.get(a.recoKey);
      if (existing) {
        existing.Invoice_No_2B = a.Invoice_No || "";
        existing.Invoice_Date_2B = a.Invoice_Date || "";
        existing.Taxable_Value_2B = a.Taxable_Value || 0;
        existing.IGST_2B = a.IGST || 0;
        existing.CGST_2B = a.CGST || 0;
        existing.SGST_2B = a.SGST || 0;
        existing.Cess_2B = a.Cess || 0;

        // Condition: If GSTIN is empty in PR, take Supplier name from 2B
        if (existing.GSTIN === "") {
          existing.Supplier_Name = a.Supplier_Name || existing.Supplier_Name;
        }

        existing.Invoice_Month_2B = a.Invoice_Month_2B || "";
        existing.Invoice_FY_2B = a.Invoice_FY_2B || "";

        if (!existing.Invoice_No_PR && existing.Invoice_No_2B) {
          existing.Status = "Not in Books";
        } else if (existing.Invoice_No_PR && existing.Invoice_No_2B) {
          const isSameFY = existing.Invoice_FY_PR === existing.Invoice_FY_2B;
          const eq = (x, y) => Math.abs(toNum(x) - toNum(y)) < 0.01;
          const isMatchedAmount =
            eq(existing.Taxable_Value_2B, existing.Taxable_Value_PR) &&
            eq(existing.IGST_2B, existing.IGST_PR) &&
            eq(existing.CGST_2B, existing.CGST_PR) &&
            eq(existing.SGST_2B, existing.SGST_PR) &&
            eq(existing.Cess_2B, existing.Cess_PR);
          existing.Status = isSameFY && isMatchedAmount ? "Matched" : "Mismatch";
        }
      } else {
        map.set(a.recoKey, {
          GSTIN: a.GSTIN || "",
          Supplier_Name: a.Supplier_Name || "",
          Invoice_Month_2B: a.Invoice_Month_2B || "",
          Invoice_FY_2B: a.Invoice_FY_2B || "",
          Invoice_No_PR: "",
          Invoice_Date_PR: "",
          Taxable_Value_PR: 0,
          IGST_PR: 0,
          CGST_PR: 0,
          SGST_PR: 0,
          Cess_PR: 0,
          Invoice_No_2B: a.Invoice_No || "",
          Invoice_Date_2B: a.Invoice_Date || "",
          Taxable_Value_2B: a.Taxable_Value || 0,
          IGST_2B: a.IGST || 0,
          CGST_2B: a.CGST || 0,
          SGST_2B: a.SGST || 0,
          Cess_2B: a.Cess || 0,
          Status: "Not in Books",
          ThreeB_Status: "",
        });
      }
    });

    const prevMonth = getPreviousMonth();

    return Array.from(map.values()).map((r) => ({
      ...r,
      Diff_Taxable: toNum(r.Taxable_Value_2B) - toNum(r.Taxable_Value_PR),
      Diff_IGST: toNum(r.IGST_2B) - toNum(r.IGST_PR),
      Diff_CGST: toNum(r.CGST_2B) - toNum(r.CGST_PR),
      Diff_SGST: toNum(r.SGST_2B) - toNum(r.SGST_PR),
      Diff_Cess: toNum(r.Cess_2B) - toNum(r.Cess_PR),
      ThreeB_Status: getThreeBStatus(
        r.Status,
        r.Invoice_Month_2B || r.Invoice_Month_PR,
        prevMonth
      ),
    }));
  };

  // Filtering function for multi-select
  const filterFns = {
    includesSome: (row, colId, filterVal) =>
      !filterVal?.length || filterVal.includes(row.getValue(colId)),
  };

  // Define columns for the React Table
  const columns = useMemo(
    () => [
      {
        accessorKey: "Invoice_FY_2B",
        header: "FY (2B)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      {
        accessorKey: "Invoice_FY_PR",
        header: "FY (PR)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      {
        accessorKey: "Invoice_Month_2B",
        header: "Month (2B)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      {
        accessorKey: "Invoice_Month_PR",
        header: "Month (PR)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      {
        accessorKey: "GSTIN",
        header: "GSTIN",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      {
        accessorKey: "Supplier_Name",
        header: "Supplier Name",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
        cell: renderWithFallback,
      },
      { accessorKey: "Invoice_No_2B", header: "Invoice No. (2B)", cell: renderWithFallback },
      { accessorKey: "Invoice_No_PR", header: "Invoice No. (PR)", cell: renderWithFallback },
      { accessorKey: "Invoice_Date_2B", header: "Invoice Date (2B)", cell: renderWithFallback },
      { accessorKey: "Invoice_Date_PR", header: "Invoice Date (PR)", cell: renderWithFallback },
      {
        accessorKey: "Taxable_Value_2B",
        header: "Taxable Value (2B)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Taxable_Value_PR",
        header: "Taxable Value (PR)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "IGST_2B",
        header: "IGST (2B)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "IGST_PR",
        header: "IGST (PR)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "CGST_2B",
        header: "CGST (2B)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "CGST_PR",
        header: "CGST (PR)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "SGST_2B",
        header: "SGST (2B)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "SGST_PR",
        header: "SGST (PR)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Cess_2B",
        header: "Cess (2B)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Cess_PR",
        header: "Cess (PR)",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_Taxable",
        header: "Diff Taxable",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_IGST",
        header: "Diff IGST",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_CGST",
        header: "Diff CGST",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_SGST",
        header: "Diff SGST",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_Cess",
        header: "Diff Cess",
        cell: renderNumericWithFallback,
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Status",
        header: "Status",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      {
        accessorKey: "ThreeB_Status",
        header: "3B Status",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
    ],
    []
  );

  // Setup react-table instance
  const table = useReactTable({
    data: reconciledData,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns,
  });

  // Helper: total sum for numeric columns in filtered rows
  const calculateSubtotal = (accessorKey) =>
    table.getFilteredRowModel().rows.reduce(
      (sum, row) => sum + toNum(row.original[accessorKey]),
      0
    );

  // Upload UI for files
  const renderUpload = (label, setter, setStatus, status) => (
    <div className="flex flex-col items-center">
      <label className="cursor-pointer bg-blue-600 text-white px-3 py-1 rounded text-sm">
        {label}
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => handleFileUpload(e, setter, setStatus)}
          className="hidden"
        />
      </label>
      {status.message && (
        <div className="mt-1 w-full text-center">
          <div
            className={`text-xs mb-1 ${
              status.type === "success"
                ? "text-green-600"
                : status.type === "error"
                ? "text-red-600"
                : "text-blue-600"
            }`}
          >
            {status.message}
          </div>
          <div className="w-full bg-gray-200 h-1 rounded">
            <div
              className={`h-1 rounded transition-all duration-700 ${
                status.type === "success"
                  ? "bg-green-500"
                  : status.type === "error"
                  ? "bg-red-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );

  // ----------------- Download Report function WITH STYLING & AUTOFIT ------------
  const downloadReport = (columns, table) => {
    const order = columns.map((c) => c.accessorKey || c.id);
    const data = table.getFilteredRowModel().rows.map((r) => {
      const row = {};
      order.forEach((c) => {
        row[c] = r.original[c];
      });
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data, { header: order });
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const headerRow = range.s.r;

    // Color headers based on text content
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = XLSX.utils.encode_cell({ r: headerRow, c });
      const cell = ws[cellRef];
      if (!cell || !cell.v) continue;
      const text = cell.v.toString().toUpperCase();

      let fillColor = "FFFFFF"; // default white
      if (text.includes("(2B)")) fillColor = "FF0000"; // Red
      else if (text.includes("(PR)")) fillColor = "0000FF"; // Blue
      else if (text.includes("DIFF")) fillColor = "008000"; // Green
      else if (text.includes("STATUS")) fillColor = "FFFF00"; // Yellow

      cell.s = {
        fill: { patternType: "solid", fgColor: { rgb: fillColor } },
        font: { bold: true, color: { rgb: fillColor === "FFFF00" ? "000000" : "FFFFFF" } },
      };
    }

    // Auto-fit columns by max data length + padding
    const colWidths = order.map((col) => {
      const maxLen = Math.max(
        col?.length || 10,
        ...data.map((row) => (row[col] ? row[col].toString().length : 0))
      );
      return { wch: maxLen + 2 };
    });
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
    XLSX.writeFile(wb, "gst_2BReco_report.xlsx");
  };
  // ---------------------------------------------------------------------------

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">GST Reconciliation With 2B</h1>

      <div className="mb-6 flex flex-wrap gap-4 justify-center items-start">
        {reconciledData.length === 0 && (
          <>
            {renderUpload("Upload GSTR-2B", setData2B, setFile2BStatus, file2BStatus)}
            {renderUpload("Upload Books", setDataBooks, setFileBooksStatus, fileBooksStatus)}
          </>
        )}

        <button
          onClick={() => {
            if (!data2B.length || !dataBooks.length) {
              alert("Upload both files");
              return;
            }
            const booksProcessed = groupByRecoKey(processRawData(dataBooks, "Books"));
            const twoBProcessed = groupByRecoKey(processRawData(data2B, "2B"));
            setReconciledData(performReconciliation(booksProcessed, twoBProcessed));
            setColumnFilters([]);
            setFile2BStatus({ message: "", type: "", progress: 0 });
            setFileBooksStatus({ message: "", type: "", progress: 0 });
          }}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm"
        >
          Reconcile
        </button>

        <button
          onClick={() => {
            const headers = [
              "MONTH",
              "GSTIN",
              "Supplier_Name",
              "Invoice_No",
              "Invoice_Date",
              "Taxable_Value",
              "IGST",
              "CGST",
              "SGST",
              "Cess",
            ];
            const ws = XLSX.utils.json_to_sheet(
              [
                {
                  MONTH: "JUL-24",
                  GSTIN: "27ABCDE1234F1Z5",
                  Supplier_Name: "Sample Supplier",
                  Invoice_No: "INV001",
                  Invoice_Date: "01-07-2024",
                  Taxable_Value: 1000,
                  IGST: 90,
                  CGST: 90,
                  SGST: 90,
                  Cess: 0,
                },
              ],
              { header: headers }
            );
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Format");
            XLSX.writeFile(wb, "gst_reco_format.xlsx");
          }}
          className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
        >
          Download Format
        </button>

        {reconciledData.length > 0 && (
          <>
            <button
              onClick={() => downloadReport(columns, table)}
              className="bg-indigo-600 text-white px-3 py-1 rounded text-sm"
            >
              Download Report
            </button>

            <button
              onClick={() => {
                setReconciledData([]);
                setData2B([]);
                setDataBooks([]);
                setColumnFilters([]);
                setFile2BStatus({ message: "", type: "", progress: 0 });
                setFileBooksStatus({ message: "", type: "", progress: 0 });
              }}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm ml-2"
            >
              Go Back
            </button>
          </>
        )}
      </div>

      {/* Uploaded Data Summary Table */}
      {reconciledData.length === 0 && (data2B.length > 0 || dataBooks.length > 0) && (
        <>
          <h2 className="text-xl font-semibold mb-3">Uploaded Data Summary</h2>
          <div className="overflow-x-auto mb-6">
            <table className="min-w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">TYPE</th>
                  <th className="border border-gray-300 px-4 py-2 text-left">DOC. NO</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">TAXABLE_VALUE</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">IGST</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">CGST</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">SGST</th>
                  <th className="border border-gray-300 px-4 py-2 text-right">CESS</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="border border-gray-300 px-4 py-2">2B</td>
                  <td className="border border-gray-300 px-4 py-2">{summaryData.twoB.docCount}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.twoB.taxableValue)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.twoB.igst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.twoB.cgst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.twoB.sgst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.twoB.cess)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="border border-gray-300 px-4 py-2">PR</td>
                  <td className="border border-gray-300 px-4 py-2">{summaryData.books.docCount}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.books.taxableValue)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.books.igst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.books.cgst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.books.sgst)}</td>
                  <td className="border border-gray-300 px-4 py-2 text-right">{fmt(summaryData.books.cess)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Main reconciliation result table */}
      {reconciledData.length > 0 && (
        <div className="overflow-auto max-h-[600px] border rounded" style={{ width: "100%", maxWidth: "100vw" }}>
          <table className="border-collapse border border-gray-300 text-sm table-auto" style={{ width: "100%", tableLayout: "auto" }}>
            <thead className="bg-gray-100 sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap"
                      style={{
                        backgroundColor:
                          h.column.columnDef.header.toString().includes("(2B)")
                            ? "#ffcccc"
                            : h.column.columnDef.header.toString().includes("(PR)")
                            ? "#cce0ff"
                            : h.column.columnDef.header.toString().toLowerCase().includes("diff")
                            ? "#ccffcc"
                            : h.column.columnDef.header.toString().toLowerCase().includes("status")
                            ? "#ffffcc"
                            : "",
                        fontWeight: "bold",
                      }}
                    >
                      {!h.isPlaceholder && flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getCanFilter() && h.column.columnDef.meta?.Filter ? (
                        <h.column.columnDef.meta.Filter column={h.column} table={table} />
                      ) : null}
                    </th>
                  ))}
                </tr>
              ))}
              <tr>
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap bg-gray-200 font-semibold"
                  >
                    {header.column.columnDef.meta?.isNumeric ? `${fmt(calculateSubtotal(header.column.id))}` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.original.Status === "Mismatch"
                      ? "bg-red-50"
                      : row.original.Status === "Matched"
                      ? "bg-green-50"
                      : row.original.Status === "Not in Books"
                      ? "bg-yellow-50"
                      : row.original.Status === "Not in 2B"
                      ? "bg-orange-50"
                      : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`border px-2 py-1 ${
                        cell.column.columnDef.meta?.isNumeric ? "text-right" : "text-left"
                      } whitespace-nowrap`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
