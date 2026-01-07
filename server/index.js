const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

app.post("/convertfile", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // 1) Upload DOCX to PDF.co
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

    const uploadedFileUrl = uploadResp.data.url;

    // 2) Convert DOCX → PDF
    const convertResp = await axios.post(
      "https://api.pdf.co/v1/pdf/convert/from/doc",
      {
        url: uploadedFileUrl,
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

    // 3) Download converted PDF and send to browser
    const pdfUrl = convertResp.data.url;
    const pdfStream = await axios.get(pdfUrl, { responseType: "stream" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${req.file.originalname.replace(/\.[^/.]+$/, "")}.pdf"`
    );

    pdfStream.data.pipe(res);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ message: "Conversion failed" });
  }
});
