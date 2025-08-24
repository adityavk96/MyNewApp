import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { reconcileData } from './brecorun';

// --- Indian Currency Formatting Function ---
const formatIndianCurrency = (amount) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00';
    }

    const [integerPart, decimalPart] = parseFloat(amount).toFixed(2).split('.');

    if (integerPart.length <= 3) {
        return integerPart.concat('.', decimalPart);
    }

    const lastThreeDigits = integerPart.slice(-3);
    let otherDigits = integerPart.slice(0, -3);

    let formatted = '';
    while (otherDigits.length > 0) {
        if (otherDigits.length > 2) {
            formatted = otherDigits.slice(-2) + ',' + formatted;
            otherDigits = otherDigits.slice(0, -2);
        } else {
            formatted = otherDigits + ',' + formatted;
            otherDigits = '';
        }
    }

    return formatted + lastThreeDigits + '.' + decimalPart;
};

// Function to get the month number from a month string
const monthToNumber = (month) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const normalizedMonth = month.substring(0, 3);
    const index = months.indexOf(normalizedMonth);
    return index !== -1 ? index : null;
};

// Converts various date formats to a comparable number (YYYYMM)
const dateToComparable = (dateString) => {
    if (!dateString) return null;
    const cleanedDate = String(dateString).trim();
    let monthNum;
    let year;
    const parts = cleanedDate.split(/[-/]/);

    if (parts.length === 2) {
        const firstPart = parts[0];
        const secondPart = parts[1];
        if (isNaN(firstPart)) {
            monthNum = monthToNumber(firstPart);
            year = parseInt(secondPart, 10);
        } else {
            monthNum = parseInt(firstPart, 10) - 1;
            year = parseInt(secondPart, 10);
        }
    } else if (parts.length === 3) {
        monthNum = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
    } else {
        return null;
    }

    if (monthNum === null || isNaN(monthNum) || isNaN(year)) {
        return null;
    }

    const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
    return parseInt(`${fullYear}${(monthNum + 1).toString().padStart(2, '0')}`, 10);
};

// Function to generate financial years
const generateFinancialYears = () => {
    const years = [];
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    let startYear = 2017;
    let endYear = currentYear;

    if (currentMonth < 4) {
        endYear -= 1;
    }

    for (let year = startYear; year <= endYear; year++) {
        const fy = `${year}-${(year + 1).toString().slice(-2)}`;
        years.push(fy);
    }
    return years;
};

// Function to get the previous month in MMM-YY format
const getPreviousMonth = () => {
    const now = new Date();
    now.setDate(1);
    now.setMonth(now.getMonth() - 1);
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const mm = months[now.getMonth()];
    const yy = String(now.getFullYear()).slice(-2);
    return `${mm}-${yy}`;
};

// Function to get the current month in MMM-YY format
const getCurrentMonth = () => {
    const now = new Date();
     now.setDate(1);
  now.setMonth(now.getMonth() - 1);
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const mm = months[now.getMonth()];
    const yy = String(now.getFullYear()).slice(-2);
    return `${mm}-${yy}`;
};

const getThreeBStatus = (status, month2B, monthPR, prevMonth, currentMonth) => {
    const invoiceMonth = status === "Not in 2B" ? monthPR : month2B;

    if (!status || !invoiceMonth) return "";

    const invoiceMonthComparable = dateToComparable(invoiceMonth);
    const prevMonthComparable = dateToComparable(prevMonth);
    const currentMonthComparable = dateToComparable(currentMonth);

    if (invoiceMonthComparable === null || prevMonthComparable === null || currentMonthComparable === null) return "";

    if (status === "Not in 2B") {
        if (invoiceMonthComparable >= prevMonthComparable) return "To be Claimed";
        return `To be claimed in ${invoiceMonth}`;
    }

    if (status === "Not in Books") {
        if (invoiceMonthComparable === currentMonthComparable) {
            return "Claimed and Reversed";
        } else {
            return `Claimed and Reversed in ${invoiceMonth}`;
        }
    }

    if (status === "Matched" || status === "Mismatch") {
        if (invoiceMonthComparable >= prevMonthComparable) return "Claimed";
        return `Claimed now Reversed in ${invoiceMonth}`;
    }
    return "";
};

const calculateSummaryData = (data, summaryType) => {
    const summary = {};
    data.forEach(row => {
        const key = row[summaryType];
        if (!summary[key]) {
            summary[key] = {
                Description: key,
                Records: 0,
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
            };
        }
        summary[key].Records += 1;
        summary[key].Taxable_Value_2B += (row.Taxable_Value_2B || 0);
        summary[key].Taxable_Value_PR += (row.Taxable_Value_PR || 0);
        summary[key].IGST_2B += (row.IGST_2B || 0);
        summary[key].IGST_PR += (row.IGST_PR || 0);
        summary[key].CGST_2B += (row.CGST_2B || 0);
        summary[key].CGST_PR += (row.CGST_PR || 0);
        summary[key].SGST_2B += (row.SGST_2B || 0);
        summary[key].SGST_PR += (row.SGST_PR || 0);
        summary[key].Cess_2B += (row.Cess_2B || 0);
        summary[key].Cess_PR += (row.Cess_PR || 0);
    });

    for (const key in summary) {
        if (summary.hasOwnProperty(key)) {
            summary[key].Taxable_Value_2B = parseFloat(summary[key].Taxable_Value_2B.toFixed(2));
            summary[key].Taxable_Value_PR = parseFloat(summary[key].Taxable_Value_PR.toFixed(2));
            summary[key].IGST_2B = parseFloat(summary[key].IGST_2B.toFixed(2));
            summary[key].IGST_PR = parseFloat(summary[key].IGST_PR.toFixed(2));
            summary[key].CGST_2B = parseFloat(summary[key].CGST_2B.toFixed(2));
            summary[key].CGST_PR = parseFloat(summary[key].CGST_PR.toFixed(2));
            summary[key].SGST_2B = parseFloat(summary[key].SGST_2B.toFixed(2));
            summary[key].SGST_PR = parseFloat(summary[key].SGST_PR.toFixed(2));
            summary[key].Cess_2B = parseFloat(summary[key].Cess_2B.toFixed(2));
            summary[key].Cess_PR = parseFloat(summary[key].Cess_PR.toFixed(2));
        }
    }
    return Object.values(summary);
};

const GstRecoPage = () => {
    const [activeTab, setActiveTab] = useState('Summary');
    const financialYears = generateFinancialYears();
    const [selectedFy, setSelectedFy] = useState(financialYears[financialYears.length - 1]);
    const [recoType, setRecoType] = useState('As per 2B');
    const [dataAsPerGst, setDataAsPerGst] = useState({
        records: 0,
        taxableValue: 0.00,
        igst: 0.00,
        cgst: 0.00,
        sgst: 0.00,
        cess: 0.00,
        totalTax: 0.00,
        raw: [],
    });
    const [dataAsPerBooks, setDataAsPerBooks] = useState({
        records: 0,
        taxableValue: 0.00,
        igst: 0.00,
        cgst: 0.00,
        sgst: 0.00,
        cess: 0.00,
        totalTax: 0.00,
        raw: [],
    });
    const [reconciliationResults, setReconciliationResults] = useState([]);

    const summaryStatus = calculateSummaryData(reconciliationResults, 'Status');
    const summary3BStatus = calculateSummaryData(reconciliationResults, 'ThreeB_Status');

    const calculateDetailedTotals = (data) => {
        return data.reduce((acc, current) => {
            acc.Records += current.Records;
            acc.Taxable_Value_2B += current.Taxable_Value_2B;
            acc.Taxable_Value_PR += current.Taxable_Value_PR;
            acc.IGST_2B += current.IGST_2B;
            acc.IGST_PR += current.IGST_PR;
            acc.CGST_2B += current.CGST_2B;
            acc.CGST_PR += current.CGST_PR;
            acc.SGST_2B += current.SGST_2B;
            acc.SGST_PR += current.SGST_PR;
            acc.Cess_2B += current.Cess_2B;
            acc.Cess_PR += current.Cess_PR;
            return acc;
        }, {
            Description: 'Total', Records: 0, Taxable_Value_2B: 0, Taxable_Value_PR: 0, IGST_2B: 0, IGST_PR: 0, CGST_2B: 0, CGST_PR: 0, SGST_2B: 0, SGST_PR: 0, Cess_2B: 0, Cess_PR: 0
        });
    };
    
    const totals3B = calculateDetailedTotals(summary3BStatus);
    const totalsStatus = calculateDetailedTotals(summaryStatus);

    const handleDownloadFormat = () => {
        const header = [
            'MONTH', 'GSTIN', 'Supplier_Name', 'Invoice_No', 'Invoice_Date',
            'Taxable_Value', 'IGST', 'CGST', 'SGST', 'Cess'
        ];
        const sampleData = [
            'JUL-24', '27ABCDE1234F1Z5', 'Sample Supplier', 'INV001', '01-07-2024', 1000, 90, 90, 90, 0
        ];
        const ws = XLSX.utils.aoa_to_sheet([header, sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Format');
        XLSX.writeFile(wb, 'Data_format.xlsx');
    };

    const handleFileUpload = (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);

            let totalRecords = data.length;
            let totalTaxableValue = 0;
            let totalIgst = 0;
            let totalCgst = 0;
            let totalSgst = 0;
            let totalCess = 0;

            data.forEach(row => {
                totalTaxableValue += row.Taxable_Value || 0;
                totalIgst += row.IGST || 0;
                totalCgst += row.CGST || 0;
                totalSgst += row.SGST || 0;
                totalCess += row.Cess || 0;
            });

            const totalTax = totalIgst + totalCgst + totalSgst + totalCess;

            const updatedData = {
                records: totalRecords,
                taxableValue: parseFloat(totalTaxableValue.toFixed(2)),
                igst: parseFloat(totalIgst.toFixed(2)),
                cgst: parseFloat(totalCgst.toFixed(2)),
                sgst: parseFloat(totalSgst.toFixed(2)),
                cess: parseFloat(totalCess.toFixed(2)),
                totalTax: parseFloat(totalTax.toFixed(2)),
                raw: data,
            };

            if (type === 'gstr') {
                setDataAsPerGst(updatedData);
            } else if (type === 'books') {
                setDataAsPerBooks(updatedData);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleDownloadReport = () => {
        if (reconciliationResults.length === 0) {
            alert("No data to download. Please run reconciliation first.");
            return;
        }

        const wb = XLSX.utils.book_new();

        const headerStyle = {
            fill: { fgColor: { rgb: "ADD8E6" } },
            font: { bold: true },
            border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        const dataStyle = {
            border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            }
        };

        // --- Create 'Reco' Sheet ---
        const headerMap = {
            'Invoice_FY_2B': 'Invoice FY 2B',
            'Invoice_FY_PR': 'Invoice FY PR',
            'Invoice_Month_2B': 'Invoice Month 2B',
            'Invoice_Month_PR': 'Invoice Month PR',
            'GSTIN': 'GSTIN',
            'Supplier_Name': 'Supplier Name',
            'Invoice_No_2B': 'Invoice No 2B',
            'Invoice_No_PR': 'Invoice No PR',
            'Invoice_Date_2B': 'Invoice Date 2B',
            'Invoice_Date_PR': 'Invoice Date PR',
            'Taxable_Value_2B': 'Taxable Value 2B',
            'Taxable_Value_PR': 'Taxable Value PR',
            'IGST_2B': 'IGST 2B',
            'IGST_PR': 'IGST PR',
            'CGST_2B': 'CGST 2B',
            'CGST_PR': 'CGST PR',
            'SGST_2B': 'SGST 2B',
            'SGST_PR': 'SGST PR',
            'Cess_2B': 'Cess 2B',
            'Cess_PR': 'Cess PR',
            'Diff_Taxable': 'Diff Taxable',
            'Diff_IGST': 'Diff IGST',
            'Diff_CGST': 'Diff CGST',
            'Diff_SGST': 'Diff SGST',
            'Diff_Cess': 'Diff Cess',
            'Status': 'Status',
            'ThreeB_Status': 'ThreeB Status'
        };
        
        const recoHeaders = Object.values(headerMap);

        const wsReco = XLSX.utils.json_to_sheet(reconciliationResults.map(row => {
            const newRow = {};
            for (const key in row) {
                if (headerMap[key]) {
                    const formattedKey = headerMap[key];
                    if (key.includes('Taxable') || key.includes('IGST') || key.includes('CGST') || key.includes('SGST') || key.includes('Cess') || key.includes('Diff')) {
                        newRow[formattedKey] = formatIndianCurrency(row[key]);
                    } else {
                        newRow[formattedKey] = row[key];
                    }
                }
            }
            return newRow;
        }), { header: recoHeaders });

        recoHeaders.forEach((header, index) => {
            const cellRef = XLSX.utils.encode_cell({ c: index, r: 0 });
            if (wsReco[cellRef]) {
                wsReco[cellRef].s = headerStyle;
            }
        });

        const recoDataRange = XLSX.utils.decode_range(wsReco['!ref']);
        for (let R = recoDataRange.s.r + 1; R <= recoDataRange.e.r; ++R) {
            for (let C = recoDataRange.s.c; C <= recoDataRange.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (wsReco[cellRef]) {
                    wsReco[cellRef].s = dataStyle;
                }
            }
        }

        const wscolsReco = recoHeaders.map(header => ({ wch: header.length + 2 }));
        wsReco['!cols'] = wscolsReco;

        XLSX.utils.book_append_sheet(wb, wsReco, 'Reco');
        
        // --- Create 'Summary' Sheet with detailed headers for both tables ---
        const detailedSummaryHeaders = ['Description', 'Records', 'Taxable Value 2B', 'Taxable Value PR', 'IGST 2B', 'IGST PR', 'CGST 2B', 'CGST PR', 'SGST 2B', 'SGST PR', 'Cess 2B', 'Cess PR'];

        const formatDetailedSummaryRow = (row) => ([
            row.Description,
            row.Records,
            formatIndianCurrency(row.Taxable_Value_2B),
            formatIndianCurrency(row.Taxable_Value_PR),
            formatIndianCurrency(row.IGST_2B),
            formatIndianCurrency(row.IGST_PR),
            formatIndianCurrency(row.CGST_2B),
            formatIndianCurrency(row.CGST_PR),
            formatIndianCurrency(row.SGST_2B),
            formatIndianCurrency(row.SGST_PR),
            formatIndianCurrency(row.Cess_2B),
            formatIndianCurrency(row.Cess_PR),
        ]);

        const summaryData = [
            ...summary3BStatus.map(formatDetailedSummaryRow),
            formatDetailedSummaryRow(totals3B),
            [],
            ...summaryStatus.map(formatDetailedSummaryRow),
            formatDetailedSummaryRow(totalsStatus)
        ];

        const wsSummary = XLSX.utils.aoa_to_sheet([detailedSummaryHeaders, ...summaryData]);

        detailedSummaryHeaders.forEach((header, index) => {
            const cellRef = XLSX.utils.encode_cell({ c: index, r: 0 });
            if (wsSummary[cellRef]) {
                wsSummary[cellRef].s = headerStyle;
            }
        });

        const summaryDataRange = XLSX.utils.decode_range(wsSummary['!ref']);
        for (let R = summaryDataRange.s.r + 1; R <= summaryDataRange.e.r; ++R) {
            for (let C = summaryDataRange.s.c; C <= summaryDataRange.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (wsSummary[cellRef]) {
                    wsSummary[cellRef].s = dataStyle;
                }
            }
        }

        const wscolsSummary = detailedSummaryHeaders.map(header => ({ wch: header.length + 2 }));
        wsSummary['!cols'] = wscolsSummary;

        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        XLSX.writeFile(wb, 'GST_Reco_Report.xlsx');
    };

    const handleRunReconciliation = () => {
        if (dataAsPerGst.raw.length === 0 || dataAsPerBooks.raw.length === 0) {
            alert('Please import both GSTR and Books data before running reconciliation.');
            return;
        }
        const results = reconcileData(dataAsPerGst.raw, dataAsPerBooks.raw);

        const prevMonth = getPreviousMonth();
        const currentMonth = getCurrentMonth();

        const resultsWith3BStatus = results.map(row => ({
            ...row,
            ThreeB_Status: getThreeBStatus(row.Status, row.Invoice_Month_2B, row.Invoice_Month_PR, prevMonth, currentMonth)
        }));

        setReconciliationResults(resultsWith3BStatus);
        alert('Reconciliation complete!');
        setActiveTab('Gst.Reconciliation');
    };

    const TabSelector = ({ activeTab, setActiveTab }) => {
        const tabs = ['Summary', 'Gst.Reconciliation', 'Reco Summary'];
        return (
            <div className="tab-selector">
                {tabs.map(tab => (
                    <button
                        key={tab}
                        className={`tab-button ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        );
    };

    const ActionButtons = () => {
        return (
            <div className="action-buttons">
                <button className="download-button" onClick={handleDownloadFormat}>Download Format</button>
                <label className="import-button gstr">
                    Import GSTR 2A OR 2B
                    <input type="file" onChange={(e) => handleFileUpload(e, 'gstr')} style={{ display: 'none' }} />
                </label>
                <label className="import-button books">
                    Import As per Books
                    <input type="file" onChange={(e) => handleFileUpload(e, 'books')} style={{ display: 'none' }} />
                </label>
            </div>
        );
    };

    const DataTable = ({ data }) => {
        const { records, taxableValue, igst, cgst, sgst, cess, totalTax } = data;
        return (
            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>RECORDS</th>
                            <th>TAXABLE VALUE</th>
                            <th>IGST</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>CESS</th>
                            <th>TOTAL TAX</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>{records.toFixed(0)}</td>
                            <td>{formatIndianCurrency(taxableValue)}</td>
                            <td>{formatIndianCurrency(igst)}</td>
                            <td>{formatIndianCurrency(cgst)}</td>
                            <td>{formatIndianCurrency(sgst)}</td>
                            <td>{formatIndianCurrency(cess)}</td>
                            <td>{formatIndianCurrency(totalTax)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    };

    const RecoTable = ({ data, recoType }) => {
        const headers = [
            'Invoice_FY_2B', 'Invoice_FY_PR', 'Invoice_Month_2B', 'Invoice_Month_PR', 'GSTIN', 'Supplier_Name',
            'Invoice_No_2B', 'Invoice_No_PR', 'Invoice_Date_2B', 'Invoice_Date_PR',
            'Taxable_Value_2B', 'Taxable_Value_PR', 'IGST_2B', 'IGST_PR', 'CGST_2B', 'CGST_PR',
            'SGST_2B', 'SGST_PR', 'Cess_2B', 'Cess_PR',
            'Diff_Taxable', 'Diff_IGST', 'Diff_CGST', 'Diff_SGST', 'Diff_Cess', 'Status'
        ];

        if (recoType === 'As per 2B') {
            headers.push('ThreeB_Status');
        }

        return (
            <div className="reco-table-container">
                <table className="reco-table">
                    <thead>
                        <tr>
                            {headers.map(header => (
                                <th key={header}>{header.replace(/_/g, ' ')}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr key={index}>
                                <td>{row.Invoice_FY_2B}</td>
                                <td>{row.Invoice_FY_PR}</td>
                                <td>{row.Invoice_Month_2B}</td>
                                <td>{row.Invoice_Month_PR}</td>
                                <td>{row.GSTIN}</td>
                                <td>{row.Supplier_Name}</td>
                                <td>{row.Invoice_No_2B}</td>
                                <td>{row.Invoice_No_PR}</td>
                                <td>{row.Invoice_Date_2B}</td>
                                <td>{row.Invoice_Date_PR}</td>
                                <td>{formatIndianCurrency(row.Taxable_Value_2B)}</td>
                                <td>{formatIndianCurrency(row.Taxable_Value_PR)}</td>
                                <td>{formatIndianCurrency(row.IGST_2B)}</td>
                                <td>{formatIndianCurrency(row.IGST_PR)}</td>
                                <td>{formatIndianCurrency(row.CGST_2B)}</td>
                                <td>{formatIndianCurrency(row.CGST_PR)}</td>
                                <td>{formatIndianCurrency(row.SGST_2B)}</td>
                                <td>{formatIndianCurrency(row.SGST_PR)}</td>
                                <td>{formatIndianCurrency(row.Cess_2B)}</td>
                                <td>{formatIndianCurrency(row.Cess_PR)}</td>
                                <td>{formatIndianCurrency(row.Diff_Taxable)}</td>
                                <td>{formatIndianCurrency(row.Diff_IGST)}</td>
                                <td>{formatIndianCurrency(row.Diff_CGST)}</td>
                                <td>{formatIndianCurrency(row.Diff_SGST)}</td>
                                <td>{formatIndianCurrency(row.Diff_Cess)}</td>
                                <td>{row.Status}</td>
                                {recoType === 'As per 2B' && <td>{row.ThreeB_Status}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const SummaryTable = ({ title, data, totals, headers }) => (
        <div className="data-section">
            <h2>{title}</h2>
            <div className="table-responsive">
                <table className="summary-table">
                    <thead>
                        <tr>
                            {headers.map((header, index) => (
                                <th key={index}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((row, index) => (
                            <tr key={index}>
                                <td>{row.Description}</td>
                                <td>{row.Records}</td>
                                {headers.slice(2).map((header, colIndex) => (
                                    <td key={colIndex}>
                                        {formatIndianCurrency(row[header.replace(/\s/g, '_')])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        <tr className="totals-row">
                            <td>{totals.Description}</td>
                            <td>{totals.Records}</td>
                             {headers.slice(2).map((header, colIndex) => (
                                <td key={colIndex}>
                                    {formatIndianCurrency(totals[header.replace(/\s/g, '_')])}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );

    const cssStyles = `
        /* Base Styles */
        body, html, #root {
            margin: 0;
            padding: 0;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
        }

        .gst-reco-container {
            font-family: Arial, sans-serif;
           padding-top: 20px;
            background-color:white;
            border-radius: 1px;
            box-shadow: 0 2px 2px rgba(0, 0, 0, 0.1);
            max-width: 1300px;
            width: 100%; 
            margin: 2px auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 10px;
            margin-bottom: 20px;
            padding-right: 20px;
        }

        .header h1 {
            font-size: 24px;
            color: #333;
        }

        .header-actions {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
        }

        .select-dropdown {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 14px;
            color: #555;
        }

        .select-dropdown select {
            padding: 5px;
            border-radius: 4px;
            border: 1px solid #ccc;
        }

        .tab-selector {
            display: flex;
            gap: 5px;
            margin-bottom: 20px;
            border-bottom: 1px solid #ccc;
            overflow-x: auto;
            white-space: nowrap;
        }

        .tab-button {
            background-color: transparent;
            border: none;
            padding: 10px 15px;
            cursor: pointer;
            font-size: 16px;
            color: #555;
            border-bottom: 3px solid transparent;
            flex-shrink: 0;
        }

        .tab-button.active {
            color: #007bff;
            font-weight: bold;
            border-bottom-color: #007bff;
        }

        .action-buttons {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            padding-right: 20px;
        }

        .import-button, .download-button, .report-download-button {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            color: black;
            font-weight: bold;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }

        .download-button {
            background-color: #d5daebff;
            
        }

        .import-button.gstr {
            background-color: #d5daebff;
        }

        .import-button.books {
            background-color: #d5daebff;
        }

        .report-download-button {
            background-color: #d5daebff;
        }

        .data-section {
            background-color: #fff;
            border-radius: 0.5px;
            padding: 15px;
            margin-bottom: 5px;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        }

        .data-section h2 {
            font-size: 18px;
            color: #333;
            margin-top: 0;
            margin-bottom: 10px;
        }

        .reco-table-container, .reco-summary-container {
            max-height: 70vh;
            max-width: 1300px;
            overflow-y: auto;
            overflow-x: auto;
            border: 1px solid #ccc;
            border-radius: 8px;
            margin: auto;
        }

        .data-table, .reco-table, .summary-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 600px;
            table-layout: auto;
            
            
        }

        .reco-table {
            min-width: 1800px;
            
        }

        

        .data-table th, .data-table td,
        .reco-table th, .reco-table td,
        .summary-table th, .summary-table td {
            border: 1px solid #ddd;
            padding: 10px;
            text-align: center;
            font-size: 14px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
                    
            
        }

        /* Highlight all table headers with light blue color */
        .data-table th, .reco-table th, .summary-table th {
            background-color: #ADD8E6;
            font-weight: bold;
            color: #333;
            position: sticky;
            top: 0;
            z-index: 10;
            
        }

        .reconciliation-actions {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
            margin-top: 20px;
            flex-wrap: wrap;
            padding-right: 20px;
        }

        .reconciliation-actions span {
            font-size: 14px;
            color: #555;
        }

        .run-button {
            padding: 10px 25px;
            background-color: #d5daebff;
            color: black;
            border: none;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
        }

        .totals-row {
            font-weight: bold;
            background-color: #e9ecef;
        }

        .reco-summary-header {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 20px;
            
        }

        /* Mobile Responsiveness */
        @media (max-width: 768px) {
            .gst-reco-container {
                padding: 10px;
            }

            .header {
                flex-direction: column;
                align-items: flex-start;
            }

            .header-actions {
                width: 100%;
                justify-content: space-between;
                margin-top: 10px;
            }
            
            .select-dropdown {
                width: 48%;
            }

            .select-dropdown select {
                width: 100%;
            }

            .tab-selector {
                flex-wrap: nowrap;
                overflow-x: auto;
                -webkit-overflow-scrolling: touch;
                border-bottom: 1px solid #ccc;
                padding-bottom: 5px;
            }

            .tab-button {
                flex: 0 0 auto;
            }

            .action-buttons {
                flex-direction: column;
                align-items: stretch;
            }

            .import-button, .download-button, .report-download-button {
                width: 100%;
                margin-bottom: 10px;
            }
            
            .reconciliation-actions {
                flex-direction: column;
                align-items: center;
                gap: 15px;
            }

            .data-table, .reco-table, .summary-table {
                font-size: 12px;
            }
            
            .reco-table-container, .reco-summary-container, .table-responsive {
                overflow-x: auto;
            }
            
            .reco-table {
                min-width: 1200px;
            }
        }
    `;

    // Headers for the detailed summary tables
    const detailedSummaryHeaders = ['Description', 'Records', 'Taxable Value 2B', 'Taxable Value PR', 'IGST 2B', 'IGST PR', 'CGST 2B', 'CGST PR', 'SGST 2B', 'SGST PR', 'Cess 2B', 'Cess PR'];

    return (
        <>
            <style>{cssStyles}</style>
            <div className="gst-reco-container">
                <div className="header">
                    <h1>GST RECO</h1>
                    <div className="header-actions">
                        <div className="select-dropdown">
                            <span>Reco Type:</span>
                            <select value={recoType} onChange={(e) => setRecoType(e.target.value)}>
                                <option>As per 2B</option>
                                <option>As per 2A</option>
                            </select>
                        </div>
                        <div className="select-dropdown">
                            <span>F.Y.:</span>
                            <select value={selectedFy} onChange={(e) => setSelectedFy(e.target.value)}>
                                {financialYears.map(fy => (
                                    <option key={fy} value={fy}>{fy}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <TabSelector activeTab={activeTab} setActiveTab={setActiveTab} />

                {activeTab === 'Summary' && (
                    <div className="summary-content">
                        <ActionButtons />
                        <div className="data-section">
                            <h2>As per 2B OR 2A</h2>
                            <DataTable data={dataAsPerGst} />
                        </div>
                        <div className="data-section">
                            <h2>As per books</h2>
                            <DataTable data={dataAsPerBooks} />
                        </div>
                        <div className="reconciliation-actions">
                            <span>Click here to run reconciliation</span>
                            <button className="run-button" onClick={handleRunReconciliation}>Run</button>
                        </div>
                    </div>
                )}

                {activeTab === 'Gst.Reconciliation' && (
                    <div className="reconciliation-content">
                        <div className="reco-table-container">
                            <RecoTable data={reconciliationResults} recoType={recoType} />
                        </div>
                    </div>
                )}

                {activeTab === 'Reco Summary' && (
                    <div className="reco-summary-content">
                        <div className="reco-summary-header">
                            <button className="report-download-button" onClick={handleDownloadReport}>Download Report</button>
                        </div>
                        <div className="reco-summary-container">
                            {recoType === 'As per 2B' && (
                                <SummaryTable title="Summary As per 3B Status" data={summary3BStatus} totals={totals3B} headers={detailedSummaryHeaders} />
                            )}
                            <SummaryTable title="Summary As per Status" data={summaryStatus} totals={totalsStatus} headers={detailedSummaryHeaders} />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default GstRecoPage;