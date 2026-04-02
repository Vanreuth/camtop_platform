// src/middlewares/upload.middleware.ts
import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
// ---------------------------
// 1) Storage (memory)
// ---------------------------
const storage = multer.memoryStorage();

// ---------------------------
// 2) Helper: allowed types
// ---------------------------
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const ALLOWED_PDF_MIME = new Set([
  "application/pdf",
  "application/x-pdf",
  "application/octet-stream",
]);

const ALLOWED_EXCEL_MIME = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
]);

function isPdfFile(file: Express.Multer.File) {
  const isPdfExt = /\.pdf$/i.test(file.originalname);
  const isPdfMime = ALLOWED_PDF_MIME.has(file.mimetype);
  return isPdfExt && isPdfMime;
}

function isImageFile(file: Express.Multer.File) {
  return ALLOWED_IMAGE_MIME.has(file.mimetype);
}

function isExcelFile(file: Express.Multer.File) {
  const isExcelExt = /\.xlsx$/i.test(file.originalname);
  const isExcelMime = ALLOWED_EXCEL_MIME.has(file.mimetype);
  return isExcelExt && isExcelMime;
}

// ---------------------------
// 3) Multer fileFilter
// ---------------------------
function fileFilter(req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  // ✅ valuation report pdf
  if (file.fieldname === "valuationPdf") {
    if (!isPdfFile(file)) {
      return cb(new Error("valuationPdf must be a valid PDF file (.pdf)"));
    }
    return cb(null, true);
  }

  // ✅ excel import file
  if (file.fieldname === "excelFile") {
    if (!isExcelFile(file)) {
      return cb(new Error("excelFile must be a valid Excel file (.xlsx)"));
    }
    return cb(null, true);
  }

  // ✅ property photos fields (image only)
  const photoFields = new Set([
     "frontSide",
     "inside",
     "leftSide",
     "rightSide",
     "opposite",
     "coverPhoto",
     "backSidePhoto",
     "gallery",
     "profilePicture",
     "buildingImage",
     "buildingImages",
  ]);

  if (photoFields.has(file.fieldname)) {
    if (!isImageFile(file)) {
      return cb(new Error(`${file.fieldname} must be an image (jpeg/png/webp)`));
    }
    return cb(null, true);
  }

  // ❌ block unexpected fields (safer)
  return cb(new Error(`Unexpected file field: ${file.fieldname}`));
}

// ---------------------------
// 4) Multer instance
// ---------------------------
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per file
    files: 30, // max total number of files
  },
});

// ---------------------------
// 5) Middleware presets (use in routes)
// ---------------------------

// For: create property + valuation + pdf + photos
export const uploadPropertyWithValuation = upload.fields([
  // valuation pdf (PDF only)
  { name: "valuationPdf", maxCount: 1 },

  // property photos (images only)
  { name: "frontSide", maxCount: 1 },
  { name: "inside", maxCount: 1 },
  { name: "leftSide", maxCount: 1 },
  { name: "rightSide", maxCount: 1 },
  { name: "opposite", maxCount: 1 },
  { name: "gallery", maxCount: 20 },

  // title document photos (images only) – optional
  { name: "coverPhoto", maxCount: 1 },
  { name: "backSidePhoto", maxCount: 1 },
]);
export function validatePdfMagicNumber(req: Request, res: any, next: any) {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const pdf = files?.valuationPdf?.[0];
  if (!pdf) return next();

  // Check the first bytes = "%PDF"
  const header = pdf.buffer.slice(0, 4).toString("utf8");
  if (header !== "%PDF") {
    return res.status(400).json({ success: false, message: "Invalid PDF content" });
  }

  next();
}
