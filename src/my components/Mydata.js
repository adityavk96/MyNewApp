import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// localStorage hook for persistence
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {}
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

// Inline form for merging data
function InlineMergeForm({ onMerge }) {
  const [vlccid, setVlccid] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [rate, setRate] = useState("");

  const onSubmit = e => {
    e.preventDefault();
    if (!vlccid || !dateKey || !rate) {
      alert("Please fill all fields");
      return;
    }
    onMerge([{ VLCCID: vlccid, [dateKey]: rate }]);
    setVlccid("");
    setDateKey("");
    setRate("");
  };

  return (
    <form onSubmit={onSubmit} className="mb-6 flex gap-3">
      <input
        type="text"
        placeholder="VLCCID"
        value={vlccid}
        onChange={e => setVlccid(e.target.value)}
        className="border px-3 py-1 rounded shadow-sm"
      />
      <input
        type="text"
        placeholder="Date (dd-mm-yyyy)"
        value={dateKey}
        onChange={e => setDateKey(e.target.value)}
        className="border px-3 py-1 rounded shadow-sm"
      />
      <input
        type="text"
        placeholder="Rate"
        value={rate}
        onChange={e => setRate(e.target.value)}
        className="border px-3 py-1 rounded shadow-sm"
      />
      <button type="submit" className="bg-blue-600 text-white px-4 rounded shadow hover:bg-blue-700">
        Merge Data
      </button>
    </form>
  );
}

export default function DataTable() {
  const [data, setData] = useLocalStorage("gstData", []);
  const [allDateKeys, setAllDateKeys] = useLocalStorage("gstDateKeys", []);
  const [sortDirection, setSortDirection] = useState({});
  const [status, setStatus] = useState({ message: "", type: "" });
  const fileInputRef = useRef();
  const [pendingUpload, setPendingUpload] = useState(null);

  // Merge new rows into localStorage data
  function mergeLongRows(newRows) {
    const newDataMap = {};
    data.forEach(row => {
      newDataMap[row.VLCCID] = {...row};
    });

    newRows.forEach(({ VLCCID, ...rest }) => {
      if (!newDataMap[VLCCID]) {
        newDataMap[VLCCID] = { VLCCID };
      }
      Object.entries(rest).forEach(([key, val]) => {
        newDataMap[VLCCID][key] = val;
      });
    });

    const mergedData = Object.values(newDataMap);
    setData(mergedData);

    const datesSet = new Set(allDateKeys);
    newRows.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k !== "VLCCID") datesSet.add(k);
      });
    });
    setAllDateKeys(Array.from(datesSet));
    setStatus({ message: "Data merged successfully!", type: "success" });
  }

  // Handle wide upload replacing data
  function batchWideOverwrite(rows) {
    setData(rows);

    const datesSet = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(k => {
        if (k !== "VLCCID") datesSet.add(k);
      });
    });
    setAllDateKeys(Array.from(datesSet));
    setStatus({ message: "Wide data uploaded successfully!", type: "success" });
  }

  const handleWideUpload = (file) => {
    if (!file) {
      setStatus({ message: "Please select a file to upload.", type: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const wideData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });

      if (!wideData.length) {
        setStatus({ message: "Empty or invalid file.", type: "error" });
        return;
      }

      const headers = Object.keys(wideData[0]);
      const vlccidHeader = headers.find(h => h.trim().toLowerCase() === "vlccid");

      if (!vlccidHeader) {
        setStatus({ message: "VLCCID header missing.", type: "error" });
        return;
      }

      const newRows = wideData.map(row => {
        const newRow = { VLCCID: String(row[vlccidHeader]) };
        headers.forEach(header => {
          if (header !== vlccidHeader && !String(header).startsWith("__EMPTY")) {
            newRow[header] = String(row[header]);
          }
        });
        return newRow;
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
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(e.target.result, { type: "binary" });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const newRows = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });

      if (!newRows.length) {
        setStatus({ message: "Empty or invalid file.", type: "error" });
        return;
      }

      const headerMap = {};
      Object.keys(newRows[0]).forEach(key => {
        if (key.trim().toLowerCase() === "vlccid") headerMap.vlccid = key;
        else if (key.trim().toLowerCase() === "date") headerMap.date = key;
        else if (key.trim().toLowerCase() === "rate") headerMap.rate = key;
      });

      if (!headerMap.vlccid || !headerMap.date || !headerMap.rate) {
        setStatus({ message: "VLCCID, DATE, RATE headers required.", type: "error" });
        return;
      }

      const formattedRows = newRows.map(row => ({
        VLCCID: String(row[headerMap.vlccid]),
        [row[headerMap.date]]: String(row[headerMap.rate])
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
    const sortedDates = [...allDateKeys].sort((a, b) => (a > b ? 1 : -1));

    const exportData = data.map(row => {
      const newRow = { VLCCID: row.VLCCID };
      sortedDates.forEach(date => {
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
  };

  const handleSort = key => {
    const direction = sortDirection[key] === "asc" ? "desc" : "asc";
    setSortDirection({ [key]: direction });
    const sorted = [...data].sort((a, b) => {
      const valA = parseFloat(a[key] || "0");
      const valB = parseFloat(b[key] || "0");
      return direction === "asc" ? valA - valB : valB - valA;
    });
    setData(sorted);
  };

  const sortedDates = [...allDateKeys].sort();

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow my-8">
      <h1 className="text-center text-2xl font-bold mb-6">Data Summary</h1>

      {/* Inline merge form */}
      <InlineMergeForm onMerge={mergeLongRows} />

      {/* Upload and Download buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="file"
          accept=".xls, .xlsx"
          ref={fileInputRef}
          className="hidden"
          onChange={e => {
            const file = e.target.files[0];
            if (pendingUpload === "wide") handleWideUpload(file);
            else if (pendingUpload === "long") handleLongUpload(file);
            setPendingUpload(null);
            e.target.value = null;
          }}
        />
        <button
          onClick={() => {
            setPendingUpload("wide");
            fileInputRef.current.click();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Upload Wide Data
        </button>
        <button
          onClick={() => {
            setPendingUpload("long");
            fileInputRef.current.click();
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Merge Long Data
        </button>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Download Data
        </button>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-gray-300 rounded-lg">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 border border-gray-300">S No</th>
              <th className="px-3 py-2 border border-gray-300">VLCCID</th>
              {sortedDates.map(date => (
                <th key={date} className="px-3 py-2 border border-gray-300 whitespace-nowrap text-xs">
                  <button onClick={() => handleSort(date)} className="flex items-center gap-1">
                    {date}
                    {sortDirection[date] ? (sortDirection[date] === "asc" ? "▲" : "▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.VLCCID}>
                <td className="text-center border border-gray-300 px-3 py-1">{i + 1}</td>
                <td className="text-center border border-gray-300 px-3 py-1">{row.VLCCID}</td>
                {sortedDates.map(date => (
                  <td key={date} className="text-center border border-gray-300 px-3 py-1">
                    {row[date] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status message */}
      {status.message && (
        <div
          className={`mt-4 p-2 rounded ${
            status.type === "success"
              ? "bg-green-200 text-green-800"
              : status.type === "error"
              ? "bg-red-200 text-red-800"
              : "bg-yellow-200 text-yellow-800"
          }`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
