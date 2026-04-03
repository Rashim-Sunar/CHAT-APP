// Cloudinary raw assets behave differently from images/videos during browser
// delivery. They may open correctly in one browser but fail to download in
// another because the CDN response is still treated as a navigable document
// instead of an attachment.
//
// This utility centralizes the download strategy for file messages:
// 1. Prefer a Cloudinary attachment URL when the asset is publicly reachable.
// 2. Fall back to a blob-based download if the browser blocks direct delivery.
// 3. Fall back again to a signed delivery URL when Cloudinary access controls
//    require authenticated delivery.
//
// The helpers below keep filename handling conservative. Cloudinary appends
// the extension for raw assets, so the attachment hint only needs the base name.

// Cloudinary attachments should use a clean download name, not the full
// original filename. Stripping the extension avoids duplicated suffixes such
// as "resume.pdf.pdf" in browsers that preserve both values.
const stripExtension = (name) => {
  if (!name) return "";

  const lastDotIndex = name.lastIndexOf(".");
  return lastDotIndex > 0 ? name.slice(0, lastDotIndex) : name;
};

export const getCloudinaryAttachmentUrl = (fileUrl, fileName) => {
  if (!fileUrl) return "";

  try {
    const parsedUrl = new URL(fileUrl);

    if (!parsedUrl.hostname.endsWith("res.cloudinary.com")) {
      return fileUrl;
    }

    // `fl_attachment` instructs Cloudinary to serve the response as a download
    // rather than an inline navigation target. This is the safest path for
    // raw files because browser behavior for PDFs and office documents varies
    // across vendors and platforms.
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

// When Cloudinary delivery is restricted, the frontend asks the backend to
// generate a signed delivery URL. This keeps API_SECRET server-side while
// still allowing a user to open or download a protected asset.
const requestSignedDeliveryUrl = async ({ publicId, fileName, messageType, attachment }) => {
  const res = await fetch("/api/messages/file-delivery-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, fileName, messageType, attachment }),
  });

  const data = await res.json();
  if (!res.ok || data.error || !data.signedUrl) {
    throw new Error(data.error || "Failed to generate signed delivery URL");
  }

  return data.signedUrl;
};

export const downloadFileWithFallback = async (fileUrl, fileName, publicId, messageType) => {
  if (!fileUrl) return;

  try {
    // First try a plain fetch so the app can save the asset as a local file.
    // This is the fastest path when the CDN responds with a public, readable
    // object and avoids unnecessary signed URL generation.
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
    // If Cloudinary blocks direct fetch for a given asset, ask the backend for a
    // signed delivery URL instead of retrying the same blocked public URL.
    // This keeps the error handling graceful for private or restricted assets.
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

export const openFileWithFallback = async (fileUrl, fileName, publicId, messageType) => {
  if (!fileUrl) return;

  try {
    // HEAD is used here as a lightweight reachability check. If Cloudinary
    // allows the asset, the browser can navigate to it directly without any
    // extra round trip through the backend.
    const response = await fetch(fileUrl, { method: "HEAD" });
    if (response.ok) {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
      return;
    }
  } catch {
    // Fall back to a signed delivery URL when the raw CDN asset is blocked or
    // when the browser cannot reach the object through a normal CDN request.
  }

  // The fallback preserves the open-in-browser behavior for users while still
  // supporting assets that require Cloudinary-signed delivery.
  const signedUrl = await requestSignedDeliveryUrl({
    publicId,
    fileName,
    messageType,
    attachment: false,
  }).catch(() => "");

  window.open(signedUrl || fileUrl, "_blank", "noopener,noreferrer");
};