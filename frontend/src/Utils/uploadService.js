import { validateFileForUpload } from "./mediaValidation";

// Performs a single direct browser-to-Cloudinary upload using a server-issued signature.
// XMLHttpRequest is used so we can report granular upload progress per file.
const uploadWithProgress = ({ file, signaturePayload, onProgress }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/${signaturePayload.resourceType}/upload`;

    xhr.open("POST", url);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          // A successful upload without parseable JSON should still surface as a failure
          // because downstream code requires secure_url and metadata fields.
          reject(new Error("Upload succeeded but response parsing failed"));
        }
        return;
      }

      reject(new Error("Cloud upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", signaturePayload.apiKey);
    formData.append("timestamp", String(signaturePayload.timestamp));
    formData.append("signature", signaturePayload.signature);
    formData.append("public_id", signaturePayload.publicId);
    formData.append("access_mode", signaturePayload.accessMode || "public");

    xhr.send(formData);
  });

// Requests a signed upload contract from backend.
// The response includes timestamp/signature/public_id/resourceType scoped for this file.
const getSignaturePayload = async (file) => {
  const res = await fetch("/api/messages/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to create upload signature");
  }

  return data;
};

// Uploads files in parallel and returns per-item settlement results.
// Consumers can keep successful uploads while reporting failed ones (partial-failure UX).
export const uploadFilesToCloudinary = async ({
  files,
  onJobStart,
  onProgress,
  maxFileSizeBytes,
}) => {
  const uploadTasks = files.map(async (file, index) => {
    // First gate: quick client-side validation to avoid unnecessary signature calls.
    const validation = validateFileForUpload(file, maxFileSizeBytes);
    if (!validation.valid) {
      throw new Error(`${file.name}: ${validation.reason}`);
    }

    const signaturePayload = await getSignaturePayload(file);
    const cloudinaryResult = await uploadWithProgress({
      file,
      signaturePayload,
      onProgress: (progress) => {
        onProgress?.(index, progress);
      },
    });

    onJobStart?.(index, signaturePayload.resourceType);

    // Return a normalized media payload shape consumed by message send API.
    return {
      file,
      messageType:
        signaturePayload.resourceType === "image"
          ? "image"
          : signaturePayload.resourceType === "video"
          ? "video"
          : "file",
      fileUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  });

  return Promise.allSettled(uploadTasks);
};
