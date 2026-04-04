import type { MessageType, FileDeliveryResponse } from "../types";

const stripExtension = (name: string): string => {
  if (!name) return "";

  const lastDotIndex = name.lastIndexOf(".");
  return lastDotIndex > 0 ? name.slice(0, lastDotIndex) : name;
};

export const getCloudinaryAttachmentUrl = (fileUrl?: string | null, fileName?: string | null): string => {
  if (!fileUrl) return "";

  try {
    const parsedUrl = new URL(fileUrl);

    if (!parsedUrl.hostname.endsWith("res.cloudinary.com")) {
      return fileUrl;
    }

    const downloadName = fileName ? stripExtension(fileName) : "download";
    const attachmentSegment = `fl_attachment:${encodeURIComponent(downloadName)}`;
    const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
    const uploadIndex = pathSegments.indexOf("upload");

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
  const res = await fetch("/api/messages/file-delivery-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, fileName, messageType, attachment }),
  });

  const data = (await res.json()) as Partial<FileDeliveryResponse> & { error?: string };
  if (!res.ok || data.error || !data.signedUrl) {
    throw new Error(data.error || "Failed to generate signed delivery URL");
  }

  return data.signedUrl;
};

export const downloadFileWithFallback = async (
  fileUrl?: string | null,
  fileName?: string | null,
  publicId?: string | null,
  messageType?: MessageType
): Promise<void> => {
  if (!fileUrl) return;

  try {
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