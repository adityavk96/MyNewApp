import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { db } from "../firebaseConfig"; // Adjust this path as needed
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";

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
  const [day, month, year] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

const COLLECTION = "yourDataTable";

export default function DataTable() {
  const [data, setData] = useState([]);
  const [allDateKeys, setAllDateKeys] = useState([]);
  const [sortDirection, setSortDirection] = useState({});
  const [status, setStatus] = useState({ message: "", type: "" });
  const fileInputRef = useRef();
  const [pendingUpload, setPendingUpload] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, COLLECTION), (snapshot) => {
      let list = [];
      let dates = new Set();
      snapshot.forEach((docSnap) => {
        const row = { VLCCID: docSnap.id, ...docSnap.data() };
        Object.keys(row).forEach(
          (key) => key !== "VLCCID" && row[key] && dates.add(key)
        );
        list.push(row);
      });
      setData(list);
      setAllDateKeys(Array.from(dates));
    });
    return () => unsubscribe();
  }, []);

  async function saveRowFirestore(vlccid, rowData) {
    await setDoc(doc(db, COLLECTION, vlccid), rowData);
  }

  async function batchWideOverwrite(rows) {
    const querySnapshot = await getDocs(collection(db, COLLECTION));
    for (const docSnap of querySnapshot.docs) {
      await deleteDoc(doc(db, COLLECTION, docSnap.id));
    }
    for (const row of rows) {
      const { VLCCID, ...rest } = row;
      await saveRowFirestore(VLCCID, rest);
    }
  }

  async function mergeLongRows(newRows) {
    for (const mergeRow of newRows) {
      const { VLCCID, ...rest } = mergeRow;
      const ref = doc(db, COLLECTION, VLCCID);
      try {
        await runTransaction(db, async (transaction) => {
          const docSnap = await transaction.get(ref);
          let current = {};
          if (docSnap.exists()) {
            current = docSnap.data();
          }
          let shouldUpdate = false;
          for (const key in rest) {
            if (current[key] !== rest[key]) {
              shouldUpdate = true;
              current[key] = rest[key];
            }
          }
          if (shouldUpdate) {
            transaction.set(ref, current);
          }
        });
      } catch (e) {
        console.error("Transaction failed: ", e);
      }
    }
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
      const wideData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: "" });
      if (!wideData.length) {
        setStatus({ message: "Uploaded file is empty or has invalid headers.", type: "error" });
        return;
      }
      const headers = Object.keys(wideData[0]);
      const vlccidHeader = headers.find(
        (h) => String(h).trim().toLowerCase() === "vlccid"
      );
      if (!vlccidHeader) {
        setStatus({
          message: 'Uploaded file must have a "VLCCID" header.',
          type: "error"
        });
        return;
      }
      const newAllDates = [];
      const newRows = [];
      wideData.forEach((row) => {
        const newRow = { VLCCID: String(row[vlccidHeader]) };
        headers.forEach((header) => {
          if (header !== vlccidHeader && !String(header).startsWith("__EMPTY")) {
            const formattedDate = isValidDate(header) ? header : formatDate(header);
            newRow[formattedDate] = String(row[header]);
            if (!newAllDates.includes(formattedDate)) newAllDates.push(formattedDate);
          }
        });
        newRows.push(newRow);
      });
      batchWideOverwrite(newRows);
      setStatus({ message: "Wide data uploaded and stored!", type: "success" });
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
        setStatus({ message: "Uploaded file is empty or has invalid headers.", type: "error" });
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
          type: "error"
        });
        return;
      }
      const formattedRows = newRows.map(row => ({
        VLCCID: String(row[headerMap.vlccid]),
        [formatDate(row[headerMap.date])]: String(row[headerMap.rate])
      }));
      mergeLongRows(formattedRows);
      setStatus({ message: "Data merged and saved!", type: "success" });
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rate Chart");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "Rate Chart.xlsx");
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

  const isHighlightRow = (row) => row["12-08-2025"] === "54" || row["12-08-2025"] === "49";
  const isHighlightCell = (row) => isHighlightRow(row) || row["12-08-2025"] === "53.25";
  const isHighlightRowSecondary = (row, key) => row.VLCCID === "3100015245" && key === "06-08-2025";
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
      <h1 className="text-2xl font-bold text-gray-800 mb-4 text-center">Rate Chart</h1>
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
        <div className={`status-message border rounded-md px-4 py-2 mt-3 text-center ${statusStyles[status.type]}`}>
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
              <tr key={row.VLCCID + rIdx} className={isHighlightRow(row) ? "bg-red-100" : ""}>
                <td className="text-center px-2">{rIdx + 1}</td>
                <td className="text-center font-medium">{row.VLCCID}</td>
                {sortedDates.map((key) => (
                  <td
                    key={key}
                    className={[
                      "text-center whitespace-nowrap border-b border-gray-200 px-3 py-2",
                      isHighlightCell(row) && row[key] && "bg-red-100",
                      isHighlightRowSecondary(row, key) && "bg-yellow-100",
                    ]
                      .filter(Boolean)
                      .join(" ")}
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
