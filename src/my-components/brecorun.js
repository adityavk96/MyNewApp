// -------------------- Helper Functions --------------------

// Converts any date value (Excel serial, string, JS Date) to MMM-YY format
const toMonthYear = (value) => {
    let dateObj;
    if (typeof value === "number") {
        // Excel serial date: 1 Jan 1900 = 1
        dateObj = new Date(1900, 0, value - 1);
    } else if (typeof value === "string") {
        // If it's already MMM-YY, return as is
        const mmmMatch = value.match(/^([A-Za-z]{3})[-/](\d{2,4})$/);
        if (mmmMatch) {
            return mmmMatch[1].charAt(0).toUpperCase() + mmmMatch[1].slice(1,3).toLowerCase() + '-' + mmmMatch[2].slice(-2);
        }
        // Try DD-MM-YYYY style
        const parts = value.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
        if (parts) {
            let mm = parseInt(parts[2]);
            let yyyy = parseInt(parts);
            if (yyyy < 100) yyyy += 2000;
            dateObj = new Date(yyyy, mm - 1, 1);
        } else {
            dateObj = new Date(value);
        }
    } else if (value instanceof Date) {
        dateObj = value;
    }
    if (!dateObj || isNaN(dateObj.getTime())) return "";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mm = months[dateObj.getMonth()];
    const yy = String(dateObj.getFullYear()).slice(-2);
    return `${mm}-${yy}`;
};

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

// Converts value to number, default 0
const toNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));

// -------------------- Main Reconciliation Logic --------------------

export const reconcileData = (gstrData, booksData) => {
  const reconciledResults = [];

  // Prepare and normalize data
  const gstrProcessed = gstrData.map(item => ({
    ...item,
    Invoice_Date: formatDate(item.Invoice_Date),
    Invoice_FY: getFYFromDate(formatDate(item.Invoice_Date)),
    // reconciliation key includes fiscal year to differentiate same invoice numbers across years
   recoKey: `${item.GSTIN}-${normalizeInvoiceNo(item.Invoice_No)}-${getFYFromDate(formatDate(item.Invoice_Date))}`,
    Taxable_Value: toNum(item.Taxable_Value),
    IGST: toNum(item.IGST),
    CGST: toNum(item.CGST),
    SGST: toNum(item.SGST),
    Cess: toNum(item.Cess),
  }));

  const booksProcessed = booksData.map(item => ({
    ...item,
    Invoice_Date: formatDate(item.Invoice_Date),
    Invoice_FY: getFYFromDate(formatDate(item.Invoice_Date)),
     // Highlighted Change: Financial year is now part of the recoKey
    recoKey: `${item.GSTIN}-${normalizeInvoiceNo(item.Invoice_No)}-${getFYFromDate(formatDate(item.Invoice_Date))}`,
    Taxable_Value: toNum(item.Taxable_Value),
    IGST: toNum(item.IGST),
    CGST: toNum(item.CGST),
    SGST: toNum(item.SGST),
    Cess: toNum(item.Cess),
  }));

  // Group data to handle duplicates
  const groupedGSTR = groupByRecoKey(gstrProcessed);
  const groupedBooks = groupByRecoKey(booksProcessed);

  const booksMap = new Map();
  groupedBooks.forEach(book => {
    booksMap.set(book.recoKey, book);
  });

  groupedGSTR.forEach(gst => {
    const matchedBook = booksMap.get(gst.recoKey);
    const result = {
      Invoice_FY_2B: gst.Invoice_FY,
      Invoice_Month_2B: toMonthYear(gst.MONTH), // <-- HIGHLIGHTED CHANGE
      GSTIN: gst.GSTIN,
      Supplier_Name: gst.Supplier_Name,
      Invoice_No_2B: gst.Invoice_No,
      Invoice_Date_2B: gst.Invoice_Date,
      Taxable_Value_2B: gst.Taxable_Value,
      IGST_2B: gst.IGST,
      CGST_2B: gst.CGST,
      SGST_2B: gst.SGST,
      Cess_2B: gst.Cess,
    };

    if (matchedBook) {
      const diffTaxable = gst.Taxable_Value - matchedBook.Taxable_Value;
      const diffIgst = gst.IGST - matchedBook.IGST;
      const diffCgst = gst.CGST - matchedBook.CGST;
      const diffSgst = gst.SGST - matchedBook.SGST;
      const diffCess = gst.Cess - matchedBook.Cess;

      result.Invoice_FY_PR = matchedBook.Invoice_FY;
      result.Invoice_Month_PR = toMonthYear(matchedBook.MONTH); // <-- HIGHLIGHTED CHANGE
      result.Invoice_No_PR = matchedBook.Invoice_No;
      result.Invoice_Date_PR = matchedBook.Invoice_Date;
      result.Taxable_Value_PR = matchedBook.Taxable_Value;
      result.IGST_PR = matchedBook.IGST;
      result.CGST_PR = matchedBook.CGST;
      result.SGST_PR = matchedBook.SGST;
      result.Cess_PR = matchedBook.Cess;
      result.Diff_Taxable = diffTaxable;
      result.Diff_IGST = diffIgst;
      result.Diff_CGST = diffCgst;
      result.Diff_SGST = diffSgst;
      result.Diff_Cess = diffCess;
      result.Status = 'Mismatch';
      result.ThreeB_Status = '';

      if (
        Math.abs(diffTaxable) < 0.01 && Math.abs(diffIgst) < 0.01 &&
        Math.abs(diffCgst) < 0.01 && Math.abs(diffSgst) < 0.01 &&
        Math.abs(diffCess) < 0.01 && gst.Invoice_FY === matchedBook.Invoice_FY
      ) {
        result.Status = 'Matched';
      }

      booksMap.delete(gst.recoKey);
    } else {
      result.Invoice_FY_PR = '';
      result.Invoice_Month_PR = '';
      result.Invoice_No_PR = '';
      result.Invoice_Date_PR = '';
      result.Taxable_Value_PR = 0;
      result.IGST_PR = 0;
      result.CGST_PR = 0;
      result.SGST_PR = 0;
      result.Cess_PR = 0;
      result.Diff_Taxable = gst.Taxable_Value;
      result.Diff_IGST = gst.IGST;
      result.Diff_CGST = gst.CGST;
      result.Diff_SGST = gst.SGST;
      result.Diff_Cess = gst.Cess;
      result.Status = 'Not in Books';
      result.ThreeB_Status = '';
    }
    reconciledResults.push(result);
  });

  // Add records from Books that were not found in GSTR
  booksMap.forEach(book => {
    reconciledResults.push({
      Invoice_FY_2B: '',
      Invoice_Month_2B: '',
      GSTIN: book.GSTIN,
      Supplier_Name: book.Supplier_Name,
      Invoice_No_2B: '',
      Invoice_Date_2B: '',
      Taxable_Value_2B: 0,
      IGST_2B: 0,
      CGST_2B: 0,
      SGST_2B: 0,
      Cess_2B: 0,
      Invoice_FY_PR: book.Invoice_FY,
      Invoice_Month_PR: toMonthYear(book.MONTH), // <-- HIGHLIGHTED CHANGE

      Invoice_No_PR: book.Invoice_No,
      Invoice_Date_PR: book.Invoice_Date,
      Taxable_Value_PR: book.Taxable_Value,
      IGST_PR: book.IGST,
      CGST_PR: book.CGST,
      SGST_PR: book.SGST,
      Cess_PR: book.Cess,
      Diff_Taxable: -book.Taxable_Value,
      Diff_IGST: -book.IGST,
      Diff_CGST: -book.CGST,
      Diff_SGST: -book.SGST,
      Diff_Cess: -book.Cess,
      Status: 'Not in Portal',
      ThreeB_Status: '',
    });
  });

  return reconciledResults;
};