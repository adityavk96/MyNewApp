import React, { useState } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import PDFMerger from "pdf-merger-js/browser";
import { saveAs } from "file-saver";

const FileToPDFConverter = () => {
  // --- State for Image to PDF ---
  const [imageFiles, setImageFiles] = useState([]);
  const [mergeImages, setMergeImages] = useState(true);
  const [imageProgress, setImageProgress] = useState(0);

  // --- State for PDF Merger ---
  const [pdfFiles, setPdfFiles] = useState([]);
  const [mergeProgress, setMergeProgress] = useState(0);

  // Image to PDF conversion
  const convertImagesToPDF = async () => {
    const validImages = imageFiles.filter((file) => file.type.startsWith("image/"));
    if (!validImages.length) return alert("Please select image files!");
    setImageProgress(0);
    if (mergeImages) {
      const doc = new jsPDF();
      for (let i = 0; i < validImages.length; i++) {
        const imgData = await getImageDataUrl(validImages[i]);
        if (i > 0) doc.addPage();
        doc.addImage(imgData, "PNG", 15, 15, 180, 0);
        setImageProgress(Math.round(((i + 1) / validImages.length) * 100));
      }
      doc.save("merged_images.pdf");
    } else {
      const zip = new JSZip();
      for (let i = 0; i < validImages.length; i++) {
        const imgData = await getImageDataUrl(validImages[i]);
        const doc = new jsPDF();
        doc.addImage(imgData, "PNG", 15, 15, 180, 0);
        const pdfBlob = doc.output("blob");
        zip.file(validImages[i].name.replace(/\..+$/, "") + ".pdf", pdfBlob);
        setImageProgress(Math.round(((i + 1) / validImages.length) * 100));
      }
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, "images_PDF_bundle.zip");
    }
  };

  const getImageDataUrl = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
      };
      reader.readAsDataURL(file);
    });

  // PDF Merger
  const mergeAndDownloadPDFs = async () => {
    if (pdfFiles.length < 2) {
      alert("Please select at least two PDF files to merge.");
      return;
    }
    setMergeProgress(0);
    try {
      const merger = new PDFMerger();
      for (let i = 0; i < pdfFiles.length; i++) {
        await merger.add(pdfFiles[i]);
        setMergeProgress(Math.round(((i + 1) / pdfFiles.length) * 100));
      }
      const mergedPdfBlob = await merger.saveAsBlob();
      saveAs(mergedPdfBlob, "merged.pdf");
      setMergeProgress(100);
    } catch (error) {
      alert("Error merging PDFs: " + error.message);
      setMergeProgress(0);
    }
  };

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0; padding: 0; height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #f4f7f9;
          color: #2c3e50;
        }
        .container {
          display: flex;
          justify-content: center;
          gap: 40px;
          padding: 40px 20px;
          flex-wrap: wrap;
        }
        .panel {
          background: white;
          border-radius: 20px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.1);
          padding: 40px 30px;
          width: 380px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .panel h2 {
          margin-bottom: 24px;
          font-weight: 600;
          font-size: 1.8rem;
          text-align: center;
        }
        input[type="file"] {
          width: 100%;
          padding: 25px;
          border-radius: 12px;
          border: 2px dashed #95a5a6;
          margin-bottom: 20px;
          font-size: 1rem;
          color: #7f8c8d;
          text-align: center;
          cursor: pointer;
          background: #fff;
          transition: border-color 0.3s ease;
        }
        input[type="file"]:hover {
          border-color: #3498db;
          color: #3498db;
        }
        label.checkbox {
          display: flex;
          align-items: center;
          cursor: pointer;
          font-size: 0.95rem;
          color: #555;
          margin-bottom: 25px;
          user-select: none;
        }
        label.checkbox input {
          margin-right: 10px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          border: 2px solid #bdc3c7;
          border-radius: 4px;
          appearance: none;
          position: relative;
          transition: all 0.3s ease;
        }
        label.checkbox input:checked {
          background-color: #3498db;
          border-color: #3498db;
        }
        label.checkbox input:checked::after {
          content: "✔";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-size: 12px;
        }
        button {
          background-color: #3498db;
          color: white;
          font-weight: 600;
          border: none;
          padding: 12px 30px;
          border-radius: 50px;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.3s ease;
          letter-spacing: 0.6px;
          user-select: none;
          min-width: 160px;
        }
        button:hover {
          background-color: #2980b9;
        }
        .progress-text {
          margin-top: 15px;
          font-weight: 600;
          color: #3498db;
        }
      `}</style>

      <div className="container">
        {/* Image to PDF Panel */}
        <div className="panel">
          <h2>📸 Image to PDF Converter</h2>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setImageFiles(Array.from(e.target.files))}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mergeImages}
              onChange={(e) => setMergeImages(e.target.checked)}
            />
            Merge all images into one PDF
          </label>
          <button onClick={convertImagesToPDF}>Convert Images</button>
          {imageProgress > 0 && imageProgress < 100 && (
            <div className="progress-text">Progress: {imageProgress}%</div>
          )}
        </div>

        {/* PDF Merger Panel */}
        <div className="panel">
          <h2>📄 PDF Merger</h2>
          <input
            type="file"
            multiple
            accept="application/pdf"
            onChange={(e) => setPdfFiles(Array.from(e.target.files))}
          />
          <button onClick={mergeAndDownloadPDFs} disabled={mergeProgress > 0 && mergeProgress < 100}>
            Merge PDFs
          </button>
          {mergeProgress > 0 && mergeProgress < 100 && (
            <div className="progress-text">Merging: {mergeProgress}%</div>
          )}
        </div>
      </div>
    </>
  );
};

export default FileToPDFConverter;
