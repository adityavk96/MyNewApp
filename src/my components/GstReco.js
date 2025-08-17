import React, { useState, useMemo } from "react";
import { useReactTable, flexRender } from "@tanstack/react-table";
import { getCoreRowModel, getFilteredRowModel } from "@tanstack/table-core";
import * as XLSX from "xlsx";
import ReactSelect from "react-select";
import makeAnimated from "react-select/animated";

const animatedComponents = makeAnimated();

const normalizeInvoiceNo = (invNo) => {
  if (!invNo) return "";
  let str = invNo.toString().toUpperCase();

  // Remove the 'HSE' and 'PR' prefixes followed by optional leading zeros
  str = str.replace(/^(HSE|PR)0*/, "");

  const fyPatterns = [
    /\b\d{2}[-/]\d{2}\b/g,
    /\b20\d{2}[-/]20\d{2}\b/g,
    /\b20\d{2}[-/]\d{2}\b/g,
  ];

  fyPatterns.forEach((pat) => {
    str = str.replace(pat, "");
  });

  str = str.replace(/[^A-Z0-9]/g, "");
  str = str.replace(/[A-Z]/g, "");
  str = str.replace(/^0+(?=\d)/, "");

  return str.trim();
};

// Robust parser for DD-MM-YYYY/YY with separators -, /, . or space
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
      const outDD = String(d.getDate()).padStart(2, "0");
      const outMM = String(d.getMonth() + 1).padStart(2, "0");
      const outYYYY = d.getFullYear();
      return `${outDD}-${outMM}-${outYYYY}`;
    }
  }
  return "";
};

const formatDate = (dateVal) => {
  if (!dateVal) return "";

  if (typeof dateVal === "number") {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateVal - 2) * 86400000);
    if (!isNaN(date.getTime())) {
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = date.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  }

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return "";
    const dd = String(dateVal.getDate()).padStart(2, "0");
    const mm = String(dateVal.getMonth() + 1).padStart(2, "0");
    const yyyy = dateVal.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  if (typeof dateVal === "string") {
    const parsed = parseDDMMYYYY(dateVal);
    if (parsed) return parsed;
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  return dateVal;
};

// Extract Month-Year from Invoice_No only
const extractMonthFromInvoiceNo = (invNo) => {
  if (!invNo) return "";
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // Pattern 1: MMM-YY (e.g., "Jan-24", "Mar.23")
  let match = invNo.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-.\/]?(\d{2})/i);
  if (match) {
    const month = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    const year = match[2];
    return `${month}-${year}`;
  }

  // Pattern 2: MM-YY (e.g., "01-24", "5/23")
  match = invNo.match(/(\d{1,2})[-.\/](\d{2})/);
  if (match) {
    const monthIndex = parseInt(match[1], 10) - 1;
    const year = match[2];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${monthNames[monthIndex]}-${year}`;
    }
  }

  return "";
};

const toNum = (val) => (isNaN(parseFloat(val)) ? 0 : parseFloat(val));
const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n;

const createOptions = (values) =>
  values.filter((v) => v !== undefined && v !== null).sort().map((v) => ({ label: v === "" ? "(Blank)" : v, value: v }));

function MultiSelectFilter({ column, table }) {
  const uniqueValues = useMemo(() => {
    const u = new Set();
    table.options.data.forEach((row) => {
      const val = row[column.id];
      u.add(val ?? "");
    });
    return Array.from(u).sort();
  }, [column.id, table.options.data]);

  const values = column.getFilterValue() || [];

  const onChange = (selectedOptions) => {
    column.setFilterValue(selectedOptions ? selectedOptions.map((o) => o.value) : []);
  };

  return (
    <ReactSelect
      options={createOptions(uniqueValues)}
      isMulti
      closeMenuOnSelect={false}
      hideSelectedOptions={false}
      components={animatedComponents}
      value={createOptions(uniqueValues).filter((o) => values.includes(o.value))}
      onChange={onChange}
      placeholder="Filter..."
      className="mt-1"
      styles={{ menu: (provided) => ({ ...provided, zIndex: 9999 }) }}
    />
  );
}

function ThreeBStatus({ status, month, previousMonth, monthOf2B }) {
  // Helper comparisons to keep it readable
  
  const isPreviousMonth = month === previousMonth;
  const isLessThanPreviousMonth = month < previousMonth; // assuming numeric or comparable value

  if (status === "NOT IN 2B") {
    return <span>{""}</span>; // Blank
  }

  if (status === "NOT IN BOOKS") {
    if (isPreviousMonth) {
      return <span>CLAIM AND REVERSED</span>;
    }
    if (isLessThanPreviousMonth) {
      return <span>CLAIM AND REVERSED IN {monthOf2B}</span>;
    }
  }

  if (status === "Matched" || status === "Mismatch") {
    if (isPreviousMonth) {
      return <span>CLAIMED</span>;
    }
    if (isLessThanPreviousMonth) {
      return <span>CLAIMED NOW REVERSED IN {monthOf2B}</span>;
    }
  }

  // Default fallback, if none of the above conditions met
  return <span>{""}</span>;
}

export default function GSTReconciliation() {
  const [data2B, setData2B] = useState([]);
  const [dataBooks, setDataBooks] = useState([]);
  const [reconciledData, setReconciledData] = useState([]);

  const parseExcel = (buffer) => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: false,
      defval: "",
    });
  };

  const handleFileUpload = (e, setData) => {
    const file = e.target.files?.[0];
    if (!file) {
      alert("No file selected");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = parseExcel(event.target.result);
        setData(json);
      } catch {
        alert("Failed to read Excel file");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processRawData = (data, source) =>
    data.map((item) => {
      let formattedDate = "";
      if (source === "2B" && typeof item.Invoice_Date === "string") {
        formattedDate = parseDDMMYYYY(item.Invoice_Date);
      }
      if (!formattedDate) {
        formattedDate = formatDate(item.Invoice_Date || "");
      }

      let invoiceMonthRaw = item.Month || item.MONTH || "";

      let invoiceMonth2B = "";
      let invoiceMonthPR = "";

      if (source === "2B") {
        invoiceMonth2B = invoiceMonthRaw || extractMonthFromInvoiceNo(item.Invoice_No);
      } else {
        invoiceMonthPR = invoiceMonthRaw;
      }

      return {
        ...item,
        recoKey: `${(item.GSTIN || "").toString().trim().toUpperCase()}__${normalizeInvoiceNo(item.Invoice_No)}`,
        Taxable_Value: toNum(item.Taxable_Value),
        IGST: toNum(item.IGST),
        CGST: toNum(item.CGST),
        SGST: toNum(item.SGST),
        Cess: toNum(item.Cess),
        Invoice_Date: formattedDate,
        Invoice_Month_2B: invoiceMonth2B,
        Invoice_Month_PR: invoiceMonthPR,
      };
    });

  const performReconciliation = (books, twoB) => {
    const map = new Map();

    books.forEach((b) => {
      map.set(b.recoKey, {
        GSTIN: b.GSTIN || "",
        Supplier_Name: b.Supplier_Name || "",
        Invoice_Month_PR: b.Invoice_Month_PR || "",
        Invoice_No_PR: b.Invoice_No || "",
        Invoice_Date_PR: b.Invoice_Date || "",
        Taxable_Value_PR: b.Taxable_Value || 0,
        IGST_PR: b.IGST || 0,
        CGST_PR: b.CGST || 0,
        SGST_PR: b.SGST || 0,
        Cess_PR: b.Cess || 0,

        Invoice_Month_2B: "",
        Invoice_No_2B: "",
        Invoice_Date_2B: "",
        Taxable_Value_2B: 0,
        IGST_2B: 0,
        CGST_2B: 0,
        SGST_2B: 0,
        Cess_2B: 0,

        Status: "Not in 2B",
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
        existing.Supplier_Name = a.Supplier_Name || existing.Supplier_Name;
        existing.Invoice_Month_2B = a.Invoice_Month_2B || "";

        const eq = (x, y) => Math.abs(toNum(x) - toNum(y)) < 0.01;
        existing.Status =
          eq(existing.Taxable_Value_2B, existing.Taxable_Value_PR) &&
          eq(existing.IGST_2B, existing.IGST_PR) &&
          eq(existing.CGST_2B, existing.CGST_PR) &&
          eq(existing.SGST_2B, existing.SGST_PR) &&
          eq(existing.Cess_2B, existing.Cess_PR)
            ? "Matched"
            : "Mismatch";

        
      } else {
        map.set(a.recoKey, {
          GSTIN: a.GSTIN || "",
          Supplier_Name: a.Supplier_Name || "",
          Invoice_Month_2B: a.Invoice_Month_2B || "",
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
        });
      }
    });

    return Array.from(map.values()).map((r) => ({
      ...r,
      Diff_Taxable: toNum(r.Taxable_Value_2B) - toNum(r.Taxable_Value_PR),
      Diff_IGST: toNum(r.IGST_2B) - toNum(r.IGST_PR),
      Diff_CGST: toNum(r.CGST_2B) - toNum(r.CGST_PR),
      Diff_SGST: toNum(r.SGST_2B) - toNum(r.SGST_PR),
      Diff_Cess: toNum(r.Cess_2B) - toNum(r.Cess_PR),
    }));
  };

  const filterFns = {
    includesSome: (row, columnId, filterValue) => {
      if (!filterValue?.length) return true;
      const rowValue = row.getValue(columnId);
      return filterValue.includes(rowValue);
    },
  };

  const [columnFilters, setColumnFilters] = useState([]);

  const columns = useMemo(
    () => [
      {
        accessorKey: "Invoice_Month_2B",
        header: "Month (2B)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      {
        accessorKey: "Invoice_Month_PR",
        header: "Month (PR)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      {
        accessorKey: "GSTIN",
        header: "GSTIN",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      {
        accessorKey: "Supplier_Name",
        header: "Supplier Name",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      {
        accessorKey: "Invoice_No_2B",
        header: "Invoice No. (2B)",
        enableColumnFilter: true,
        filterFn: "includesSome",
        meta: { Filter: MultiSelectFilter },
      },
      { accessorKey: "Invoice_No_PR", header: "Invoice No. (PR)" },
      { accessorKey: "Invoice_Date_2B", header: "Invoice Date (2B)" },
      { accessorKey: "Invoice_Date_PR", header: "Invoice Date (PR)" },
      {
        accessorKey: "Taxable_Value_2B",
        header: "Taxable Value (2B)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Taxable_Value_PR",
        header: "Taxable Value (PR)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "IGST_2B",
        header: "IGST (2B)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "IGST_PR",
        header: "IGST (PR)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "CGST_2B",
        header: "CGST (2B)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "CGST_PR",
        header: "CGST (PR)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "SGST_2B",
        header: "SGST (2B)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "SGST_PR",
        header: "SGST (PR)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Cess_2B",
        header: "Cess (2B)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Cess_PR",
        header: "Cess (PR)",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_Taxable",
        header: "Diff Taxable",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_IGST",
        header: "Diff IGST",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_CGST",
        header: "Diff CGST",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_SGST",
        header: "Diff SGST",
        cell: ({ getValue }) => fmt(getValue()),
        meta: { isNumeric: true },
      },
      {
        accessorKey: "Diff_Cess",
        header: "Diff Cess",
        cell: ({ getValue }) => fmt(getValue()),
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

  const table = useReactTable({
    data: reconciledData,
    columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns,
  });

  const subtotal = table.getFilteredRowModel().rows.reduce(
    (acc, row) => {
      const d = row.original;
      acc.Taxable_Value_2B += toNum(d.Taxable_Value_2B);
      acc.Taxable_Value_PR += toNum(d.Taxable_Value_PR);
      acc.IGST_2B += toNum(d.IGST_2B);
      acc.IGST_PR += toNum(d.IGST_PR);
      acc.CGST_2B += toNum(d.CGST_2B);
      acc.CGST_PR += toNum(d.CGST_PR);
      acc.SGST_2B += toNum(d.SGST_2B);
      acc.SGST_PR += toNum(d.SGST_PR);
      acc.Cess_2B += toNum(d.Cess_2B);
      acc.Cess_PR += toNum(d.Cess_PR);
      acc.Diff_Taxable += toNum(d.Diff_Taxable);
      acc.Diff_IGST += toNum(d.Diff_IGST);
      acc.Diff_CGST += toNum(d.Diff_CGST);
      acc.Diff_SGST += toNum(d.Diff_SGST);
      acc.Diff_Cess += toNum(d.Diff_Cess);
      return acc;
    },
    {
      Taxable_Value_2B: 0,
      Taxable_Value_PR: 0,
      IGST_2B: 0,
      IGST_PR: 0,
      CGST_2B: 0,
      CGST_PR: 0,
      SGST_2B: 0,
      SGST_PR: 0,
      Cess_2B: 0,
      Cess_PR: 0,
      Diff_Taxable: 0,
      Diff_IGST: 0,
      Diff_CGST: 0,
      Diff_SGST: 0,
      Diff_Cess: 0,
    }
  );

  const downloadFormat = () => {
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
    const sampleRow = {
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
    };
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Format");
    XLSX.writeFile(wb, "gst_reco_format.xlsx");
  };

  const downloadReport = () => {
    const order = columns.map((c) => c.accessorKey || c.id);
    const data = table.getFilteredRowModel().rows.map((r) => {
      const row = {};
      order.forEach((col) => {
        row[col] = r.original[col];
      });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: order });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reconciliation");
    XLSX.writeFile(wb, "gst_2BReco_report.xlsx");
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-center">GST Reconciliation With 2B</h1>

      <div className="mb-4 flex flex-wrap gap-4 items-center justify-center">
        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded inline-block">
          Upload GSTR-2B (xlsx)
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileUpload(e, setData2B)}
            className="hidden"
          />
        </label>

        <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded inline-block">
          Upload Books (xlsx)
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => handleFileUpload(e, setDataBooks)}
            className="hidden"
          />
        </label>

        <button
          onClick={() => {
            if (!data2B.length || !dataBooks.length) {
              alert("Please upload both files before reconciling.");
              return;
            }
            const processedBooks = processRawData(dataBooks, "Books");
            const processed2B = processRawData(data2B, "2B");
            const result = performReconciliation(processedBooks, processed2B);
            setReconciledData(result);
            setColumnFilters([]);
          }}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Reconcile
        </button>

        <button
          onClick={downloadFormat}
          className="bg-gray-600 text-white px-4 py-2 rounded"
        >
          Download Format
        </button>

        {reconciledData.length > 0 && (
          <>
            <button
              onClick={downloadReport}
              className="bg-indigo-600 text-white px-4 py-2 rounded ml-2"
            >
              Download Report
            </button>

            <button
              onClick={() => {
                setReconciledData([]);
                setData2B([]);
                setDataBooks([]);
                setColumnFilters([]);
              }}
              className="bg-gray-700 text-white px-4 py-2 rounded ml-2"
            >
              Go Back to Upload
            </button>
          </>
        )}
      </div>

      {reconciledData.length > 0 && (
        <div
          className="overflow-auto max-h-[600px] border rounded"
          style={{ width: "100%", maxWidth: "100vw" }}
        >
          <table
            className="border-collapse border border-gray-300 text-sm table-auto"
            style={{ width: "100%", tableLayout: "auto" }}
          >
            <thead className="bg-gray-100 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="border border-gray-300 px-2 py-1 text-left whitespace-nowrap"
                    >
                      {header.isPlaceholder ? null : (
                        <>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {header.column.getCanFilter() &&
                          header.column.columnDef.meta?.Filter ? (
                            <header.column.columnDef.meta.Filter
                              column={header.column}
                              table={table}
                            />
                          ) : null}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
              <tr className="font-bold bg-gray-200 sticky top-[68px] z-10">
                <td
                  colSpan={9}
                  className="text-right border border-gray-300 px-2 py-1"
                >
                  Subtotal
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Taxable_Value_2B)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Taxable_Value_PR)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.IGST_2B)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.IGST_PR)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.CGST_2B)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.CGST_PR)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.SGST_2B)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.SGST_PR)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Cess_2B)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Cess_PR)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Diff_Taxable)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Diff_IGST)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Diff_CGST)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Diff_SGST)}
                </td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  {fmt(subtotal.Diff_Cess)}
                </td>
                <td className="border border-gray-300 px-2 py-1"></td>
                <td className="border border-gray-300 px-2 py-1"></td>
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
                      : ""
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`border border-gray-300 px-2 py-1 ${
                        cell.column.columnDef.meta?.isNumeric
                          ? "text-right"
                          : "text-left"
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
