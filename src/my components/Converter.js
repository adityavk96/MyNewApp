import React, { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const NUTRIENT_SDK_URL = "/assets/nutrient-viewer.js";

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });

const CircularProgress = ({ percent }) => {
  const radius = 40;
  const stroke = 6;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percent / 100) * circumference;
  return (
    <svg
      height={radius * 2}
      width={radius * 2}
      style={{ transform: "rotate(-90deg)", display: "block", margin: "0 auto" }}
    >
      <circle
        stroke="#e6e6e6"
        fill="transparent"
        strokeWidth={stroke}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <circle
        stroke="#3498db"
        fill="transparent"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        style={{ strokeDashoffset, transition: "stroke-dashoffset 0.4s ease" }}
        r={normalizedRadius}
        cx={radius}
        cy={radius}
      />
      <text
        x="50%"
        y="50%"
        dy=".3em"
        textAnchor="middle"
        fontSize="1.1rem"
        fill="#3498db"
        fontWeight="bold"
      >
        {percent}%
      </text>
    </svg>
  );
};

const FileToPDFConverter = () => {
  const [imageFiles, setImageFiles] = useState([]);
  const [docFiles, setDocFiles] = useState([]);
  const [mergeImages, setMergeImages] = useState(true);
  const [mergeDocs, setMergeDocs] = useState(true);
  const [nutrientLoaded, setNutrientLoaded] = useState(false);

  const [imageProgress, setImageProgress] = useState(0);
  const [docProgress, setDocProgress] = useState(0);

  const containerRef = useRef(null);

  useEffect(() => {
    loadScript(NUTRIENT_SDK_URL)
      .then(() => setNutrientLoaded(true))
      .catch(console.error);
  }, []);

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
      doc.save("Merged_images.pdf");
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
      saveAs(content, "images_PDF.zip");
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

  const convertDocsToPDF = async () => {
    if (!nutrientLoaded) {
      alert("Nutrient SDK is still loading. Please wait.");
      return;
    }
    if (!docFiles.length) return alert("Please select DOC/DOCX files!");
    setDocProgress(0);

    try {
      const baseUrl = `${window.location.protocol}//${window.location.host}/assets/`;
      if (mergeDocs) {
        const buffer = await docFiles[0].arrayBuffer();
        const viewer = await window.NutrientViewer.load({
          baseUrl,
          container: containerRef.current,
          document: buffer,
        });
        const pdfBuffer = await viewer.exportPDF();
        const blob = new Blob([pdfBuffer], { type: "application/pdf" });
        saveAs(blob, "merged_documents.pdf");
        setDocProgress(100);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < docFiles.length; i++) {
          const buffer = await docFiles[i].arrayBuffer();
          const viewer = await window.NutrientViewer.load({
            baseUrl,
            container: containerRef.current,
            document: buffer,
          });
          const pdfBuffer = await viewer.exportPDF();
          zip.file(docFiles[i].name.replace(/\..+$/, "") + ".pdf", pdfBuffer);
          setDocProgress(Math.round(((i + 1) / docFiles.length) * 100));
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "documents_bundle.zip");
      }
    } catch (error) {
      alert("Error converting DOC/DOCX to PDF: " + error.message);
      setDocProgress(0);
    }
  };

  return (
    <>
      <style>{`
        html, body, #root {
          height: 100%;
          margin: 0;
          padding: 0;
        }
        .main-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          color: #2c3e50;
          background-color: #f4f7f9;
          justify-content: center;
          align-items: flex-start;
          gap: 40px;
          padding: 60px 20px;
        }
        .panel {
          flex: 1;
          max-width: 400px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 6px 12px rgba(0, 0, 0, 0.1);
          padding: 40px 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
        }
        .panel:hover {
          transform: translateY(-6px);
          box-shadow: 0 14px 24px rgba(0, 0, 0, 0.15);
        }
        .panel h1 {
          font-size: 1.8rem;
          font-weight: 600;
          margin-bottom: 2rem;
          text-align: center;
          color: #2c3e50;
        }
        input[type="file"] {
          border: 2px dashed #95a5a6;
          padding: 25px;
          border-radius: 12px;
          width: 80%;
          max-width: 350px;
          font-size: 1rem;
          color: #7f8c8d;
          text-align: center;
          margin-bottom: 20px;
          cursor: pointer;
          transition: border-color 0.3s ease;
          background-color: #fff;
        }
        input[type="file"]:hover {
          border-color: #3498db;
          color: #3498db;
        }
        .checkbox {
          font-size: 0.95rem;
          color: #555;
          user-select: none;
          display: flex;
          align-items: center;
          cursor: pointer;
          margin-bottom: 25px;
        }
        .checkbox input {
          margin-right: 10px;
          width: 18px;
          height: 18px;
          cursor: pointer;
          appearance: none;
          border: 2px solid #bdc3c7;
          border-radius: 4px;
          position: relative;
          transition: all 0.3s ease;
        }
        .checkbox input:checked {
          background-color: #3498db;
          border-color: #3498db;
        }
        .checkbox input:checked::after {
          content: "✔";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
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
        .progress-container-horizontal {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 20px;
          width: 100%;
        }
      `}</style>

      <div className="main-container">
        <div className="panel">
          <h1>📸 Image to PDF Converter</h1>
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
          {/* Show horizontal progress container with single progress ring in this panel only */}
          {imageProgress > 0 && (
            <div className="progress-container-horizontal">
              <CircularProgress percent={imageProgress} />
            </div>
          )}
        </div>

        <div className="panel">
          <h1>📝 DOC/DOCX to PDF Converter</h1>
          <input
            type="file"
            multiple
            accept=".doc,.docx"
            onChange={(e) => setDocFiles(Array.from(e.target.files))}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={mergeDocs}
              onChange={(e) => setMergeDocs(e.target.checked)}
            />
            Merge all documents into one PDF
          </label>
          <button onClick={convertDocsToPDF}>Convert Documents</button>
          {/* Show horizontal progress container with single progress ring in this panel only */}
          {docProgress > 0 && (
            <div className="progress-container-horizontal">
              <CircularProgress percent={docProgress} />
            </div>
          )}
        </div>

        <div
          ref={containerRef}
          id="nutrient-container"
          style={{ width: 0, height: 0, overflow: "hidden", position: "absolute" }}
        />
      </div>
    </>
  );
};

export default FileToPDFConverter;
