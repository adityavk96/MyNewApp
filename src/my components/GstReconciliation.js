import React, { useState, useMemo } from "react";
import { useReactTable, flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel } from "@tanstack/table-core";
import * as XLSX from "xlsx"; // For reading Excel files
import ExcelJS from "exceljs"; // For Excel export with styling
import { saveAs } from "file-saver"; // For triggering file downloads
import ReactSelect from "react-select"; // For multi-select dropdowns in filters
import makeAnimated from "react-select/animated";

const animatedComponents = makeAnimated(); // Animated components for ReactSelect

// -------------------- Helper Functions --------------------

// Groups data by recoKey aggregating numeric values
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

// Normalizes invoice number by removing prefixes and fiscal year patterns
const normalizeInvoiceNo = (invNo) => {
  if (!invNo) return "";
  let str = invNo.toString().toUpperCase().trim();
  str = str.replace(/^(HSE|PR)0*/, "");
  const fyPatterns = [/\b\d{2}[-/]\d{2}\b/g, /\b20\d{2}[-/]20\d{2}\b/g, /\b20\d{2}[-/]\d{2}\b/g];
  fyPatterns.forEach((pat) => {
    str = str.replace(pat, "");
  });
  str = str.replace(/[^0-9]/g, "");
  str = str.replace(/^0+(?=\d)/, "");
  return str;
};

// Parses DD/MM/YYYY or similar strings to DD-MM-YYYY format
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
      return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
    }
  }
  return "";
};

// Formats various date inputs to DD-MM-YYYY string
const formatDate = (dateVal) => {
  if (!dateVal) return "";
  if (typeof dateVal === "number") {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateVal - 2) * 86400000);
    if (!isNaN(date.getTime())) {
      return `${String(date.getDate()).padStart(2,"0")}-${String(date.getMonth()+1).padStart(2,"0")}-${date.getFullYear()}`;
    }
  }
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "";
    return `${String(dateVal.getDate()).padStart(2,"0")}-${String(dateVal.getMonth()+1).padStart(2,"0")}-${dateVal.getFullYear()}`;
  }
  if (typeof dateVal === "string") {
    const parsed = parseDDMMYYYY(dateVal);
    if (parsed) return parsed;
  }
  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  }
  return dateVal;
};

// Extract month and year string like "Jan-22" from invoice number text
const extractMonthFromInvoiceNo = (invNo) => {
  if (!invNo) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  let match = invNo.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-./]?(\d{2})/i);
  if (match) {
    return `${match[1].charAt(0).toUpperCase()+match[1].slice(1).toLowerCase()}-${match[2]}`;
  }
  match = invNo.match(/(\d{1,2})[-./](\d{2})/);
  if (match) {
    const mi = parseInt(match[1],10) - 1;
    if (mi >= 0 && mi < 12) return `${months[mi]}-${match[2]}`;
  }
  return "";
};

// Converts value to number, default 0
const toNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

// Formats number as Indian currency locale with 2 decimals
const fmt = (n) => typeof n === "number"
  ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : n;

// Render fallback for empty table cells
const renderWithFallback = ({ getValue }) => getValue() || "-";

// Numeric renderer, show absolute values except Diff columns (raw values)
const renderNumericWithFallback = ({ getValue, column }) => {
  const value = getValue();
  const isDiffColumn = column.id.startsWith("Diff_");
  const displayValue = isDiffColumn ? value : Math.abs(value);
  return displayValue === 0 ? "-" : fmt(displayValue);
};

// Helper to create ReactSelect options from list
const createOptions = (values) =>
  values.filter(v => v !== undefined && v !== null)
    .sort()
    .map(v => ({ label: v === "" ? "(Blank)" : v, value: v }));

// Multi-select filter component for ReactSelect usage in filters
function MultiSelectFilter({ column, table }) {
  const uniqueValues = useMemo(() => {
    const u = new Set();
    table.options.data.forEach(row => u.add(row[column.id] ?? ""));
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
      value={createOptions(uniqueValues).filter(o => values.includes(o.value))}
      onChange={opts => column.setFilterValue(opts ? opts.map(o => o.value) : [])}
      placeholder="Filter..."
      className="mt-1"
      styles={{ menu: p => ({ ...p, zIndex: 9999 }) }}
    />
  );
}

// Computes previous month in "Mon-YY" format
//function getPreviousMonth() {
  //const now = new Date();
  //now.setDate(1);
  //now.setMonth(now.getMonth() - 1);
  //const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  //return `${months[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
//}

// Returns financial year string FYxxxx-yy from DD-MM-YYYY
const getFYFromDate = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length !== 3) return "";
  const dd = parseInt(parts[0],10);
  const mm = parseInt(parts[1],10) - 1;
  const yyyy = parseInt(parts[2],10);
  if (isNaN(dd) || isNaN(mm) || isNaN(yyyy) || dd < 1 || dd > 31 || mm < 0 || mm > 11 || yyyy < 1900) return "";
  const dateObj = new Date(yyyy, mm, dd);
  if (isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  if (month >= 4) return `FY${year}-${String(year + 1).slice(-2)}`;
  else return `FY${year - 1}-${String(year).slice(-2)}`;
};

// -------------------- Main React Component --------------------

export default function GSTReconciliation() {
  // State for uploaded and reconciled data and UI status
  const [data2A, setData2A] = useState([]);
  const [dataBooks, setDataBooks] = useState([]);
  const [reconciledData, setReconciledData] = useState([]);
  const [columnFilters, setColumnFilters] = useState([]);
  const [file2AStatus, setFile2AStatus] = useState({ message: "", type: "", progress: 0 });
  const [fileBooksStatus, setFileBooksStatus] = useState({ message: "", type: "", progress: 0 });

  // Parses Excel file buffer into JSON
  const parseExcel = (buf) => {
    const wb = XLSX.read(buf, { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false, defval: "" });
  };

  // File upload handler reading and parsing Excel data
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

  // Processes raw uploaded data, normalizes dates and keys
  const processRawData = (data, source) =>
    data.map((item) => {
      let originalDate = item.Invoice_Date || item.PR_Date || "";
      let dateFormatted = formatDate(originalDate);

      if (source === "2A" && typeof originalDate === "string") {
        const parsed = parseDDMMYYYY(originalDate);
        dateFormatted = parsed || dateFormatted;
      }

      const fy = dateFormatted ? getFYFromDate(dateFormatted) : "";

      return {
        ...item,
        recoKey: `${(item.GSTIN || "").toString().trim().toUpperCase()}__${normalizeInvoiceNo(item.Invoice_No || item.PR_No)}__${fy}`,
        Taxable_Value: toNum(item.Taxable_Value),
        IGST: toNum(item.IGST),
        CGST: toNum(item.CGST),
        SGST: toNum(item.SGST),
        Cess: toNum(item.Cess),
        Invoice_Date: dateFormatted,
        Invoice_Month_2A: source === "2A" ? item.Month || item.MONTH || extractMonthFromInvoiceNo(item.Invoice_No) : "",
        Invoice_Month_PR: source === "Books" ? item.Month || item.MONTH || "" : "",
        Invoice_FY_2A: source === "2A" ? fy : "",
        Invoice_FY_PR: source === "Books" ? fy : "",
      };
    });

  // Performs reconciliation by matching 2A and Book data based on keys and conditions
  const performReconciliation = (books, twoB) => {
    const map = new Map();

    // Initialize map with Books data
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
        Invoice_Month_2A: "",
        Invoice_FY_2A: "",
        Invoice_No_2A: "",
        Invoice_Date_2A: "",
        Taxable_Value_2A: 0,
        IGST_2A: 0,
        CGST_2A: 0,
        SGST_2A: 0,
        Cess_2A: 0,
        Status: "Not in 2A",
      });
    });

    // Reconcile with 2A data and update status and other fields
    twoB.forEach((a) => {
      const existing = map.get(a.recoKey);
      if (existing) {
        existing.Invoice_No_2A = a.Invoice_No || "";
        existing.Invoice_Date_2A = a.Invoice_Date || "";
        existing.Taxable_Value_2A = a.Taxable_Value || 0;
        existing.IGST_2A = a.IGST || 0;
        existing.CGST_2A = a.CGST || 0;
        existing.SGST_2A = a.SGST || 0;
        existing.Cess_2A = a.Cess || 0;

        // Prefer supplier name from 2A if GSTIN missing in books
        if (existing.GSTIN === "") {
          existing.Supplier_Name = a.Supplier_Name || existing.Supplier_Name;
        }

        existing.Invoice_Month_2A = a.Invoice_Month_2A || "";
        existing.Invoice_FY_2A = a.Invoice_FY_2A || "";

        if (!existing.Invoice_No_PR && existing.Invoice_No_2A) {
          existing.Status = "Not in Books";
        } else if (existing.Invoice_No_PR && existing.Invoice_No_2A) {
          const isSameFY = existing.Invoice_FY_PR === existing.Invoice_FY_2A;
          const eq = (x, y) => Math.abs(toNum(x) - toNum(y)) < 0.01;
          const isMatchedAmount =
            eq(existing.Taxable_Value_2A, existing.Taxable_Value_PR) &&
            eq(existing.IGST_2A, existing.IGST_PR) &&
            eq(existing.CGST_2A, existing.CGST_PR) &&
            eq(existing.SGST_2A, existing.SGST_PR) &&
            eq(existing.Cess_2A, existing.Cess_PR);
          existing.Status = isSameFY && isMatchedAmount ? "Matched" : "Mismatch";
        }
      } else {
        // If 2A record missing in Books, add with status Not in Books
        map.set(a.recoKey, {
          GSTIN: a.GSTIN || "",
          Supplier_Name: a.Supplier_Name || "",
          Invoice_Month_2A: a.Invoice_Month_2A || "",
          Invoice_FY_2A: a.Invoice_FY_2A || "",
          Invoice_No_PR: "",
          Invoice_Date_PR: "",
          Taxable_Value_PR: 0,
          IGST_PR: 0,
          CGST_PR: 0,
          SGST_PR: 0,
          Cess_PR: 0,
          Invoice_No_2A: a.Invoice_No || "",
          Invoice_Date_2A: a.Invoice_Date || "",
          Taxable_Value_2A: a.Taxable_Value || 0,
          IGST_2A: a.IGST || 0,
          CGST_2A: a.CGST || 0,
          SGST_2A: a.SGST || 0,
          Cess_2A: a.Cess || 0,
          Status: "Not in Books",
        });
      }
    });

    // Calculate Diff columns before returning array
    return Array.from(map.values()).map((r) => ({
      ...r,
      Diff_Taxable: toNum(r.Taxable_Value_2A) - toNum(r.Taxable_Value_PR),
      Diff_IGST: toNum(r.IGST_2A) - toNum(r.IGST_PR),
      Diff_CGST: toNum(r.CGST_2A) - toNum(r.CGST_PR),
      Diff_SGST: toNum(r.SGST_2A) - toNum(r.SGST_PR),
      Diff_Cess: toNum(r.Cess_2A) - toNum(r.Cess_PR),
    }));
  };

  // Table filter function for multi-select filters
  const filterFns = {
    includesSome: (row, colId, filterVal) => !filterVal?.length || filterVal.includes(row.getValue(colId)),
  };

  // Column definitions for React Table
  const columns = useMemo(() => [
    { accessorKey: "Invoice_FY_2A", header: "FY (2A)", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "Invoice_FY_PR", header: "FY (PR)", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "Invoice_Month_2A", header: "Month (2A)", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "Invoice_Month_PR", header: "Month (PR)", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "GSTIN", header: "GSTIN", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "Supplier_Name", header: "Supplier Name", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter }, cell: renderWithFallback },
    { accessorKey: "Invoice_No_2A", header: "Invoice No. (2A)", cell: renderWithFallback },
    { accessorKey: "Invoice_No_PR", header: "Invoice No. (PR)", cell: renderWithFallback },
    { accessorKey: "Invoice_Date_2A", header: "Invoice Date (2A)", cell: renderWithFallback },
    { accessorKey: "Invoice_Date_PR", header: "Invoice Date (PR)", cell: renderWithFallback },
    { accessorKey: "Taxable_Value_2A", header: "Taxable Value (2A)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Taxable_Value_PR", header: "Taxable Value (PR)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "IGST_2A", header: "IGST (2A)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "IGST_PR", header: "IGST (PR)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "CGST_2A", header: "CGST (2A)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "CGST_PR", header: "CGST (PR)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "SGST_2A", header: "SGST (2A)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "SGST_PR", header: "SGST (PR)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Cess_2A", header: "Cess (2A)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Cess_PR", header: "Cess (PR)", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Diff_Taxable", header: "Diff Taxable", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Diff_IGST", header: "Diff IGST", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Diff_CGST", header: "Diff CGST", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Diff_SGST", header: "Diff SGST", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Diff_Cess", header: "Diff Cess", cell: renderNumericWithFallback, meta: { isNumeric: true } },
    { accessorKey: "Status", header: "Status", enableColumnFilter: true, filterFn: "includesSome", meta: { Filter: MultiSelectFilter } },
  ], []);

  // Create the React Table instance
  const table = useReactTable({
    data: reconciledData,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns,
  });

  // Calculates sum of specified numeric column in filtered rows for footer summary
  const calculateSubtotal = (accessorKey) =>
    table.getFilteredRowModel().rows.reduce((sum, row) => sum + toNum(row.original[accessorKey]), 0);

  // Renders file upload input and status bars
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
          <div className={`text-xs mb-1 ${status.type === "success" ? "text-green-600" : status.type === "error" ? "text-red-600" : "text-blue-600"}`}>
            {status.message}
          </div>
          <div className="w-full bg-gray-200 h-1 rounded">
            <div
              className={`h-1 rounded transition-all duration-700 ${status.type === "success" ? "bg-green-500" : status.type === "error" ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${status.progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );

  // Memoized summary data for uploaded datasets 2A and Books
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
        {
          docCount: 0,
          taxableValue: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
          cess: 0,
        }
      );
    };
    return {
      twoB: calculateSums(data2A),
      books: calculateSums(dataBooks),
    };
  }, [data2A, dataBooks]);

  // Excel export with styled header, autofit columns, and conditional row background colors
  const exportStyledExcel = async (data, columns) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reconciliation");

    worksheet.columns = columns.map((col) => ({
      header: col.header,
      key: col.accessorKey || col.id,
      width: 20,
    }));

    // Header row styles: blue background and white bold font
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2A52BE" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    // Add rows and apply conditional background colors based on status
    data.forEach((rowData) => {
      const row = worksheet.addRow(rowData);
      let fillColor = null;
      switch (rowData.Status) {
        case "Matched":
          fillColor = "FFC6EFCE"; // Light green
          break;
        case "Mismatch":
          fillColor = "FFFFC7CE"; // Light red
          break;
        case "Not in Books":
          fillColor = "FFFFEB9C"; // Yellow
          break;
        case "Not in 2A":
          fillColor = "FFFFE4B5"; // Orange
          break;
        default:
          fillColor = null;
      }
      if (fillColor) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
        });
      }
    });

    // Autofit columns by maximum cell content length
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value) {
          const length = cell.value.toString().length;
          if (length > maxLength) maxLength = length;
        }
      });
      column.width = maxLength < 20 ? 20 : maxLength;
    });

    // Write workbook to buffer and trigger file download
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "gst_2AReco.xlsx");
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">GST Reconciliation With 2A</h1>

      {/* File upload buttons and reconciliation */}
      <div className="mb-6 flex flex-wrap gap-4 justify-center items-start">
        {reconciledData.length === 0 && (
          <>
            {renderUpload("Upload GSTR-2A", setData2A, setFile2AStatus, file2AStatus)}
            {renderUpload("Upload Books", setDataBooks, setFileBooksStatus, fileBooksStatus)}
          </>
        )}

        {/* Reconcile button to process data */}
        <button
          onClick={() => {
            if (!data2A.length || !dataBooks.length) {
              alert("Upload both files");
              return;
            }
            const booksProcessed = groupByRecoKey(processRawData(dataBooks, "Books"));
            const twoBProcessed = groupByRecoKey(processRawData(data2A, "2A"));
            setReconciledData(performReconciliation(booksProcessed, twoBProcessed));
            setColumnFilters([]);
            setFile2AStatus({ message: "", type: "", progress: 0 });
            setFileBooksStatus({ message: "", type: "", progress: 0 });
          }}
          className="bg-green-600 text-white px-3 py-1 rounded text-sm"
        >
          Reconcile
        </button>

        {/* Download format template */}
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
            const ws = XLSX.utils.json_to_sheet([
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
            ], { header: headers });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Format");
            XLSX.writeFile(wb, "gst_reco_format.xlsx");
          }}
          className="bg-gray-600 text-white px-3 py-1 rounded text-sm"
        >
          Download Format
        </button>

        {/* Buttons for download styled report & clear data */}
        {reconciledData.length > 0 && (
          <>
            <button
              onClick={() => {
                const order = columns.map((c) => c.accessorKey || c.id);
                const data = table.getFilteredRowModel().rows.map((r) => {
                  const row = {};
                  order.forEach((c) => {
                    row[c] = r.original[c];
                  });
                  return row;
                });
                exportStyledExcel(data, columns);
              }}
              className="bg-indigo-600 text-white px-3 py-1 rounded text-sm"
            >
              Download Report
            </button>

            <button
              onClick={() => {
                setReconciledData([]);
                setData2A([]);
                setDataBooks([]);
                setColumnFilters([]);
                setFile2AStatus({ message: "", type: "", progress: 0 });
                setFileBooksStatus({ message: "", type: "", progress: 0 });
              }}
              className="bg-gray-700 text-white px-3 py-1 rounded text-sm"
            >
              Go Back
            </button>
          </>
        )}
      </div>

      {/* Uploaded data summary when no reconciliation done */}
      {reconciledData.length === 0 && (data2A.length > 0 || dataBooks.length > 0) && (
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
                  <td className="border border-gray-300 px-4 py-2">2A</td>
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

      {/* Reconciled data table */}
      {reconciledData.length > 0 && (
        <div
          className="overflow-auto max-h-[600px] border rounded"
          style={{ width: "100%", maxWidth: "100vw" }}
        >
          <table className="border-collapse border border-gray-300 text-sm table-auto" style={{ width: "100%", tableLayout: "auto" }}>
            <thead className="bg-gray-100 sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap"
                    >
                      {h.isPlaceholder ? null : (
                        <>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getCanFilter() && h.column.columnDef.meta?.Filter ? (
                            <h.column.columnDef.meta.Filter column={h.column} table={table} />
                          ) : null}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
              <tr>
                {table.getFlatHeaders().map((header) => (
                  <th key={header.id} className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap bg-gray-200 font-semibold">
                    {header.column.columnDef.meta?.isNumeric ? `${fmt(calculateSubtotal(header.column.id))}` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} 
                  className={
                    row.original.Status === "Mismatch" ? "bg-red-50" :
                    row.original.Status === "Matched" ? "bg-green-50" :
                    row.original.Status === "Not in Books" ? "bg-yellow-50" :
                    row.original.Status === "Not in 2A" ? "bg-orange-50" : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`border px-2 py-1 ${cell.column.columnDef.meta?.isNumeric ? "text-right" : "text-left"} whitespace-nowrap`}
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
