import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3Client";
import type { FileField } from "../modules/property/property.dto";

const buildObjectKey = (folder: string, filename: string) => {
  const sanitizedFilename = filename
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9.-]/g, "");

  return `${folder}/${Date.now()}-${sanitizedFilename}`;
};

const resolveObjectKey = (keyOrUrl: string) => {
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";
  if (!publicUrl) {
    return keyOrUrl;
  }

  return keyOrUrl.replace(`${publicUrl}/`, "");
};

const uploadFile = async (
  file: Express.Multer.File,
  folder: string = "uploads"
): Promise<string> => {
  try {
    const key = buildObjectKey(folder, file.originalname);

    const uploader = new Upload({
      client: s3,
      params: {
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
    });

    await uploader.done();

    return `${process.env.CLOUDFLARE_R2_PUBLIC_URL}/${key}`;
  } catch (error) {
    throw new Error("File upload failed");
  }
};

const uploadMultipleFiles = async (
  files: Express.Multer.File[],
  folder: string = "uploads"
): Promise<string[]> => {
  return Promise.all(files.map((file) => uploadFile(file, folder)));
};

const uploadPdfBuffer = async (
  buffer: Buffer,
  key: string,
  contentType: string = "application/pdf"
): Promise<{ key: string }> => {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    return { key };
  } catch (error) {
    throw new Error("PDF upload failed");
  }
};

const uploadPdf = async (
  file: Express.Multer.File,
  folder: string = "uploads/pdfs"
): Promise<{ key: string }> => {
  const key = buildObjectKey(folder, file.originalname);
  const contentType =
    file.mimetype && file.mimetype.includes("pdf")
      ? file.mimetype
      : "application/pdf";

  return uploadPdfBuffer(file.buffer, key, contentType);
};

const signedDownloadUrl = async (
  keyOrUrl: string,
  expiresInSeconds: number = 600,
  opts?: { filename?: string }
): Promise<string> => {
  const key = resolveObjectKey(keyOrUrl);
  if (!key) {
    throw new Error("Invalid storage key");
  }

  const cmd = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
    Key: key,
    ...(opts?.filename
      ? {
          ResponseContentDisposition: `attachment; filename="${opts.filename}"; filename*=UTF-8''${encodeURIComponent(
            opts.filename
          )}`,
        }
      : {}),
  });

  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
};

const signedViewUrl = async (
  keyOrUrl: string,
  expiresInSeconds: number = 600,
  opts?: { filename?: string; mimeType?: string }
): Promise<string> => {
  const key = resolveObjectKey(keyOrUrl);
  if (!key) throw new Error("Invalid storage key");

  const filename = opts?.filename ?? "document.pdf";
  const mimeType = opts?.mimeType ?? "application/pdf";

  const cmd = new GetObjectCommand({
    Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
    Key: key,
    // ✅ force browser preview
    ResponseContentDisposition: `inline; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
      filename
    )}`,
    // ✅ make sure content-type is pdf (helpful if stored wrong)
    ResponseContentType: mimeType,
  });

  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
};



/**
 * Deletes a file from R2 using its public URL.
 */
const deleteFile = async (fileUrl: string): Promise<void> => {
  try {
    const key = resolveObjectKey(fileUrl);
    if (!key) return;

    await s3.send(
      new DeleteObjectCommand({
        Bucket: process.env.CLOUDFLARE_BUCKET_NAME!,
        Key: key,
      })
    );
  } catch (err: any) {
    console.error("Failed to delete from R2:", err.message);
  }
};

// Helper : Delete Old Image from R2
const deleteOldImage = async (oldUrl: string | null | undefined) => {
  if (oldUrl && oldUrl.startsWith(process.env.CLOUDFLARE_R2_PUBLIC_URL || "")) {
    try {
      await FileUploadService.deleteFile(oldUrl);
      console.log(`✅ Deleted old image: ${oldUrl}`);
    } catch (error) {
      console.error(`❌ Failed to delete old image: ${oldUrl}`, error);
    }
  }
};

// Helper : Delete Multiple Images from R2
const deleteOldImages = async (oldUrls: (string | null | undefined)[]) => {
  const validUrls = oldUrls.filter(
    (url) =>
      url &&
      typeof url === "string" &&
      url.startsWith(process.env.CLOUDFLARE_R2_PUBLIC_URL || "")
  );

  if (validUrls.length === 0) {
    console.log("No valid images to delete from R2");
    return;
  }

  console.log(`🗑️ Deleting ${validUrls.length} images from R2...`);

  const deletePromises = validUrls.map(async (url) => {
    try {
      await FileUploadService.deleteFile(url!);
      console.log(`✅ Deleted: ${url}`);
    } catch (error) {
      console.error(`❌ Failed to delete: ${url}`, error);
    }
  });

  await Promise.allSettled(deletePromises);
  console.log(`🏁 Completed deletion process for ${validUrls.length} images`);
};

// Halper : Handle Building Image Upload

const uploadBuildingImages = async (
  files: FileField,
  buildingCount: number
): Promise<Record<number, string>> => {
  const buildingImageMap: Record<number, string> = {};

  // If single buildingImage field is used
  if (files.buildingImage && files.buildingImage.length > 0) {
    const url = await FileUploadService.uploadFile(
      files.buildingImage[0],
      "properties/buildings"
    );
    buildingImageMap[0] = url; // Assign to first building
  }

  // If multiple buildingImages field is used (array)
  if (files.buildingImages && files.buildingImages.length > 0) {
    for (
      let i = 0;
      i < Math.min(files.buildingImages.length, buildingCount);
      i++
    ) {
      const url = await FileUploadService.uploadFile(
        files.buildingImages[i],
        "properties/buildings"
      );
      buildingImageMap[i] = url;
    }
  }

  return buildingImageMap;
};


export const FileUploadService = {
  uploadFile,
  uploadMultipleFiles,
  uploadPdfBuffer,
  uploadPdf,
  signedDownloadUrl,
  signedViewUrl,
  deleteFile,
  deleteOldImage,
  deleteOldImages,
  uploadBuildingImages,
};
