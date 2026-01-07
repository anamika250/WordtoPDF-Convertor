const express = require('express');
const multer = require('multer');
const docxtoPDF = require('docx-pdf');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// -------- Serve frontend --------
const frontendPath = path.join(__dirname, "../client/dist");
app.use(express.static(frontendPath));

// -------- Ensure folders exist --------
const uploadDir = path.join(__dirname, 'uploads');
const filesDir = path.join(__dirname, 'files');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir);

// -------- Multer setup --------
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// -------- API route --------
app.post('/convertfile', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const outputPath = path.join(filesDir, `${req.file.originalname}.pdf`);

    docxtoPDF(req.file.path, outputPath, (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Error converting docx to PDF' });
      }
      res.download(outputPath);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// -------- React fallback --------
app.get("/*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
