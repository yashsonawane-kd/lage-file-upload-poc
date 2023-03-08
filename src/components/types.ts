export interface CompletedUpload {
    ETag: string,
    PartNumber: number
}

export type PresignedUrlsRequestParams = {
  uploadId: string;
  numberOfChunks: number;
  key: string;
};