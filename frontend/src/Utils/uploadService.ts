import { validateFileForUpload, resolveCloudinaryResourceType } from "./mediaValidation";
import type {
  ResourceType,
  SendMessagePayload,
  UploadSignatureResponse,
} from "../types";

type UploadProgressHandler = (index: number, progress: number) => void;
type JobStartHandler = (index: number, resourceType: ResourceType) => void;

interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
}

interface UploadWithProgressOptions {
  file: File;
  signaturePayload: UploadSignatureResponse;
  onProgress?: (progress: number) => void;
}

const uploadWithProgress = ({ file, signaturePayload, onProgress }: UploadWithProgressOptions) =>
  new Promise<CloudinaryUploadResponse>((resolve, reject) => {
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
          resolve(JSON.parse(xhr.responseText) as CloudinaryUploadResponse);
        } catch {
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

const getSignaturePayload = async (file: File): Promise<UploadSignatureResponse> => {
  const res = await fetch("/api/messages/upload-signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
    }),
  });

  const data = (await res.json()) as Partial<UploadSignatureResponse> & { error?: string };
  if (!res.ok || data.error) {
    throw new Error(data.error || "Failed to create upload signature");
  }

  return data as UploadSignatureResponse;
};

export interface PreparedUploadMessage extends SendMessagePayload {
  file: File;
}

export const uploadFilesToCloudinary = async ({
  files,
  onJobStart,
  onProgress,
  maxFileSizeBytes,
}: {
  files: File[];
  onJobStart?: JobStartHandler;
  onProgress?: UploadProgressHandler;
  maxFileSizeBytes?: number;
}): Promise<PromiseSettledResult<PreparedUploadMessage>[]> => {
  const uploadTasks = files.map(async (file, index) => {
    const validation = validateFileForUpload(file, maxFileSizeBytes);
    if (!validation.valid) {
      throw new Error(`${file.name}: ${validation.reason}`);
    }

    const signaturePayload = await getSignaturePayload(file);
    const resourceType = resolveCloudinaryResourceType(file.type) || signaturePayload.resourceType;

    const cloudinaryResult = await uploadWithProgress({
      file,
      signaturePayload: { ...signaturePayload, resourceType },
      onProgress: (progress) => {
        onProgress?.(index, progress);
      },
    });

    onJobStart?.(index, resourceType);

    return {
      file,
      messageType: (
        resourceType === "image" ? "image" : resourceType === "video" ? "video" : "file"
      ) as SendMessagePayload["messageType"],
      fileUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  });

  return Promise.allSettled(uploadTasks);
};