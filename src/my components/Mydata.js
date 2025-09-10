import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// Custom Hook to sync state with localStorage
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

function formatDateDDMMYYYY(dateObjOrString) {
  const date = new Date(dateObjOrString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatDate(excelDate) {
  if (typeof excelDate === "number") {
    const jsDate = new Date(Date.UTC(0, 0, excelDate - 1));
    return formatDateDDMMYYYY(jsDate);
  }
  return formatDateDDMMYYYY(excelDate);
}

function isValidDate(dateStr) {
  const regex = /^\d{2}-\d{2}-\d{4}$/;
  if (!regex.test(dateStr)) return false;
  const [day, month, year] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export default function DataTable() {
  const [data, setData] = useLocalStorage("gstData", []);
  const [allDateKeys, setAllDateKeys] = useLocalStorage("gstDateKeys", []);
  const [sortDirection, setSortDirection] = useState({});
  const [status, setStatus] = useState({ message: "", type: "" });
  const fileInputRef = useRef();
  const [pendingUpload, setPendingUpload] = useState(null);

  // Overwrite wide data - merge rows with same VLCCID
  function batchWideOverwrite(rows) {
    const uniqueMap = new Map();

    rows.forEach((row) => {
      if (!uniqueMap.has(row.VLCCID)) {
        uniqueMap.set(row.VLCCID, { ...row });
      } else {
        // Merge duplicate VLCCID rows: add/overwrite date rates
        const existing = uniqueMap.get(row.VLCCID);
        Object.entries(row).forEach(([k, v]) => {
          if (k !== "VLCCID" && v) {
            existing[k] = v; // overwrite latest if duplicate date
          }
        });
        uniqueMap.set(row.VLCCID, existing);
      }
    });

    const mergedRows = Array.from(uniqueMap.values());
    setData(mergedRows);

    // Update date keys
    const datesSet = new Set();
    mergedRows.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "VLCCID") datesSet.add(k);
      });
    });
    setAllDateKeys(Array.from(datesSet));

    setStatus({ message: "Wide data merged successfully!", type: "success" });
  }

  // Merge long data - keeps one row per VLCCID
  function mergeLongRows(newRows) {
    const newDataMap = {};

    // Load existing
    data.forEach((row) => {
      newDataMap[row.VLCCID] = { ...row };
    });

    // Merge new rows
    newRows.forEach((mergeRow) => {
      const { VLCCID, ...rest } = mergeRow;
      if (!newDataMap[VLCCID]) {
        newDataMap[VLCCID] = { VLCCID };
      }
      Object.entries(rest).forEach(([k, v]) => {
        if (v) {
          newDataMap[VLCCID][k] = v; // overwrite if exists
        }
      });
    });

    const updatedData = Object.values(newDataMap);
    setData(updatedData);

    // Update date keys
    const datesSet = new Set(allDateKeys);
    updatedData.forEach((row) => {
      Object.keys(row).forEach((k) => {
        if (k !== "VLCCID") datesSet.add(k);
      });
    });
    setAllDateKeys(Array.from(datesSet));

    setStatus({ message: "Long data merged successfully!", type: "success" });
  }

  const handleWideUpload = (file) => {
    if (!file) {
      setStatus({ message: "Please select a file to upload.", type: "error" });
      return;
    }
    setStatus({ message: "Uploading wide data...", type: "info" });

    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const wideData = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
        defval: "",
      });

      if (!wideData.length) {
        setStatus({
          message: "Uploaded file is empty or has invalid headers.",
          type: "error",
        });
        return;
      }

      const headers = Object.keys(wideData[0]);
      const vlccidHeader = headers.find(
        (h) => String(h).trim().toLowerCase() === "vlccid"
      );

      if (!vlccidHeader) {
        setStatus({
          message: 'Uploaded file must have a "VLCCID" header.',
          type: "error",
        });
        return;
      }

      const newRows = [];
      wideData.forEach((row) => {
        const newRow = { VLCCID: String(row[vlccidHeader]) };
        headers.forEach((header) => {
          if (header !== vlccidHeader && !String(header).startsWith("__EMPTY")) {
            const formattedDate = isValidDate(header) ? header : formatDate(header);
            newRow[formattedDate] = String(row[header]);
          }
        });
        newRows.push(newRow);
      });

      batchWideOverwrite(newRows);
    };
    reader.readAsBinaryString(file);
  };

  const handleLongUpload = (file) => {
    if (!file) {
      setStatus({ message: "Please select a file to merge.", type: "error" });
      return;
    }
    setStatus({ message: "Merging new data...", type: "info" });

    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const newRows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });

      if (!newRows.length) {
        setStatus({
          message: "Uploaded file is empty or has invalid headers.",
          type: "error",
        });
        return;
      }

      const headerMap = {};
      Object.keys(newRows[0]).forEach((key) => {
        if (String(key).trim().toLowerCase() === "vlccid") headerMap.vlccid = key;
        if (String(key).trim().toLowerCase() === "date") headerMap.date = key;
        if (String(key).trim().toLowerCase() === "rate") headerMap.rate = key;
      });

      if (!headerMap.vlccid || !headerMap.date || !headerMap.rate) {
        setStatus({
          message: 'Uploaded file must have "VLCCID", "date", and "RATE" headers.',
          type: "error",
        });
        return;
      }

      const formattedRows = newRows.map((row) => ({
        VLCCID: String(row[headerMap.vlccid]),
        [formatDate(row[headerMap.date])]: String(row[headerMap.rate]),
      }));

      mergeLongRows(formattedRows);
    };
    reader.readAsBinaryString(file);
  };

  const handleDownload = () => {
    if (!data.length) {
      setStatus({ message: "No data to download.", type: "error" });
      return;
    }
    setStatus({ message: "Preparing file for download...", type: "info" });

    const sortedDates = [...allDateKeys].sort((a, b) => {
      const dateA = a.split("-").reverse().join("-");
      const dateB = b.split("-").reverse().join("-");
      return new Date(dateB) - new Date(dateA);
    });

    const exportData = data.map((row) => {
      const newRow = { VLCCID: row.VLCCID };
      sortedDates.forEach((date) => {
        newRow[date] = row[date] || "";
      });
      return newRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Summary");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "Data Summary.xlsx");

    setStatus({ message: "File downloaded successfully!", type: "success" });
  };

  const handleSort = (key) => {
    const direction = sortDirection[key] === "asc" ? "desc" : "asc";
    setSortDirection({ [key]: direction });
    const sorted = [...data].sort((a, b) => {
      const valA = parseFloat(a[key] || "0");
      const valB = parseFloat(b[key] || "0");
      return direction === "asc" ? valA - valB : valB - valA;
    });
    setData(sorted);
  };

  const sortedDates = [...allDateKeys].sort((a, b) => {
    const dateA = a.split("-").reverse().join("-");
    const dateB = b.split("-").reverse().join("-");
    return new Date(dateB) - new Date(dateA);
  });

  const statusStyles = {
    success: "bg-green-100 text-green-800 border-green-300",
    error: "bg-red-100 text-red-800 border-red-300",
    info: "bg-gray-100 text-gray-800 border-gray-300",
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (pendingUpload === "wide") handleWideUpload(file);
    if (pendingUpload === "long") handleLongUpload(file);
    setPendingUpload(null);
    e.target.value = null;
  };

  return (
    <div className="container max-w-6xl mx-auto py-6 px-4 bg-white rounded-xl shadow-md my-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">
        Data Summary
      </h1>

      <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6 p-4 border border-dashed border-gray-300 rounded-lg">
        <div className="flex flex-col items-center">
          <div className="text-gray-600 text-sm mb-2">Click to upload a new Excel file.</div>
          <input
            type="file"
            accept=".xlsx, .xls"
            ref={fileInputRef}
            className="hidden"
            onChange={onFileChange}
          />
          <button
            onClick={() => {
              setPendingUpload("wide");
              fileInputRef.current.click();
            }}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 transition duration-300 w-full whitespace-nowrap"
          >
            Upload Wide Data
          </button>
        </div>

        <button
          onClick={() => {
            setPendingUpload("long");
            fileInputRef.current.click();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 transition duration-300 whitespace-nowrap"
        >
          Merge Long Data
        </button>

        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 transition duration-300 whitespace-nowrap"
        >
          Download Data
        </button>
      </div>

      {status.message && (
        <div
          className={`status-message border rounded-md px-4 py-2 mt-3 text-center ${statusStyles[status.type]}`}
        >
          {status.message}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="data-table table-auto min-w-full rounded-lg border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="rounded-tl-lg bg-gray-300 text-gray-700 font-semibold uppercase cursor-pointer whitespace-nowrap">
                S No
              </th>
              <th className="bg-gray-300 text-gray-700 font-semibold uppercase cursor-pointer whitespace-nowrap">
                VLCCID
              </th>
              {sortedDates.map((date) => (
                <th
                  key={date}
                  onClick={() => handleSort(date)}
                  className="bg-gray-300 text-gray-700 font-semibold uppercase cursor-pointer relative whitespace-nowrap text-xs px-3"
                >
                  {date}
                  {sortDirection[date] && (
                    <span className="sort-icon absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-bold text-gray-600">
                      {sortDirection[date] === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
              <th className="rounded-tr-lg bg-gray-300"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rIdx) => (
              <tr key={row.VLCCID + rIdx}>
                <td className="text-center px-2">{rIdx + 1}</td>
                <td className="text-center font-medium">{row.VLCCID}</td>
                {sortedDates.map((key) => (
                  <td
                    key={key}
                    className="text-center whitespace-nowrap border-b border-gray-200 px-3 py-2"
                  >
                    {row[key] || ""}
                  </td>
                ))}
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
