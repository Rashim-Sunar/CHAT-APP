import type { MessageType, FileDeliveryResponse } from "../types";
import { apiFetch } from "./apiFetch";

// Cloudinary attachment links are rewritten so browser downloads use the intended filename.
const stripExtension = (name: string): string => {
  if (!name) return "";

  const lastDotIndex = name.lastIndexOf(".");
  return lastDotIndex > 0 ? name.slice(0, lastDotIndex) : name;
};

export const getCloudinaryAttachmentUrl = (fileUrl?: string | null, fileName?: string | null): string => {
  if (!fileUrl) return "";

  try {
    const parsedUrl = new URL(fileUrl);

    // Only Cloudinary URLs support the attachment transformation we need here.
    if (!parsedUrl.hostname.endsWith("res.cloudinary.com")) {
      return fileUrl;
    }

    const downloadName = fileName ? stripExtension(fileName) : "download";
    const attachmentSegment = `fl_attachment:${encodeURIComponent(downloadName)}`;
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const uploadIndex = pathSegments.indexOf("upload");

    // Preserve the original asset path and inject the attachment flag after /upload.
    if (uploadIndex === -1) {
      return fileUrl;
    }

    pathSegments.splice(uploadIndex + 1, 0, attachmentSegment);
    parsedUrl.pathname = `/${pathSegments.join("/")}`;

    return parsedUrl.toString();
  } catch {
    return fileUrl;
  }
};

// Ask the backend for a signed URL when the public asset cannot be fetched directly.
const requestSignedDeliveryUrl = async ({
  publicId,
  fileName,
  messageType,
  attachment,
}: {
  publicId?: string | null;
  fileName?: string | null;
  messageType?: MessageType;
  attachment: boolean;
}): Promise<string> => {
  const data = await apiFetch<Partial<FileDeliveryResponse> & { error?: string }>(
    "/messages/file-delivery-url",
    {
      method: "POST",
      body: JSON.stringify({ publicId, fileName, messageType, attachment }),
    }
  );

  if (data.error || !data.signedUrl) {
    throw new Error(data.error || "Failed to generate signed delivery URL");
  }

  return data.signedUrl;
};

// Prefer a direct download first, then fall back to a signed URL, and finally the raw asset.
export const downloadFileWithFallback = async (
  fileUrl?: string | null,
  fileName?: string | null,
  publicId?: string | null,
  messageType?: MessageType
): Promise<void> => {
  if (!fileUrl) return;

  try {
    // Fetch the file as a blob so we can force a download in the browser.
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error("Primary download request failed");
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = objectUrl;
    anchor.download = fileName || "download";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.URL.revokeObjectURL(objectUrl);
  } catch {
    // If the raw file cannot be fetched, try a backend-signed attachment URL.
    const signedUrl = await requestSignedDeliveryUrl({
      publicId,
      fileName,
      messageType,
      attachment: true,
    }).catch(() => "");

    if (signedUrl) {
      window.open(signedUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }
};

// Opening follows the same fallback strategy, but uses inline delivery instead of attachment mode.
export const openFileWithFallback = async (
  fileUrl?: string | null,
  fileName?: string | null,
  publicId?: string | null,
  messageType?: MessageType
): Promise<void> => {
  if (!fileUrl) return;

  try {
    const response = await fetch(fileUrl, { method: "HEAD" });
    if (response.ok) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    // Fall back to a signed delivery URL when the raw CDN asset is blocked.
  }

  const signedUrl = await requestSignedDeliveryUrl({
    publicId,
    fileName,
    messageType,
    attachment: false,
  }).catch(() => "");

  window.open(signedUrl || fileUrl, "_blank", "noopener,noreferrer");
};