export interface CompletedUpload {
  ETag: string;
  PartNumber: number;
}

export type PresignedUrlsRequestParams = {
  bucket: string;
  expires: number;
  uploadId: string;
  numberOfChunks: number;
  objectName: string;
};
