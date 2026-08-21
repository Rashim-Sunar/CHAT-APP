// ----------------------------------------
// @file   story.d.ts
// @desc   DTOs for stories/status operations
// ----------------------------------------

export type StoryType = 'image' | 'video' | 'text';
export type StoryPrivacy = 'everyone' | 'close_friends';

export interface CreateStoryUploadSignatureDto {
  fileName: string;
  mimeType: string;
  fileSize: number;
}

export interface CreateStoryDto {
  type: StoryType;
  caption?: string;
  text?: string;
  textAlign?: 'left' | 'center' | 'right';
  background?: string;
  privacy?: StoryPrivacy;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  publicId?: string;
}
