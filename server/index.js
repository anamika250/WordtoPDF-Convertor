const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const app = express(); 
const PORT = process.env.PORT || 3000;

app.use(cors());

// ---------- Serve frontend ----------
const frontendPath = path.join(__dirname, "../client/dist");
app.use(express.static(frontendPath));

// ---------- Ensure upload folder ----------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// ---------- Multer setup ----------
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// ---------- PDF.co conversion route ----------
app.post("/convertfile", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 1. Upload file to PDF.co
    const uploadForm = new FormData();
    uploadForm.append(
      "file",
      fs.createReadStream(req.file.path),
      req.file.originalname
    );

    const uploadResp = await axios.post(
      "https://api.pdf.co/v1/file/upload",
      uploadForm,
      {
        headers: {
          ...uploadForm.getHeaders(),
          "x-api-key": process.env.PDFCO_API_KEY,
        },
      }
    );

    if (uploadResp.data.error) {
      return res.status(500).json({ message: uploadResp.data.message });
    }

    // 2. Convert DOCX → PDF
    const convertResp = await axios.post(
      "https://api.pdf.co/v1/pdf/convert/from/doc",
      {
        url: uploadResp.data.url,
        async: false,
        name: req.file.originalname.replace(/\.[^/.]+$/, ".pdf"),
      },
      {
        headers: {
          "x-api-key": process.env.PDFCO_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (convertResp.data.error) {
      return res.status(500).json({ message: convertResp.data.message });
    }

    // 3. Download and stream PDF to client
    const pdfStream = await axios.get(convertResp.data.url, {
      responseType: "stream",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.file.originalname.replace(
        /\.[^/.]+$/,
        ""
      )}.pdf"`
    );

    pdfStream.data.pipe(res);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Conversion failed" });
  }
});

// ---------- React fallback ----------
app.get("/*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// ---------- Start server ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
