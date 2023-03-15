import { CompletedUpload } from "./types";
import { MAX_RETRY_INTERVAL, PRESIGNED_URLS_EXPIRY } from "./constants";
import { ChunkUploader } from "./ChunkUploader";
import axios, { AxiosResponse } from "axios";
import { PresignedUrlsRequestParams } from "./types";
export class LargeFileUploader {
  file: File;
  uploadId: string;
  numberOfChunks: number;
  deliveredChunks: CompletedUpload[];
  chunkUploaderIndexToChunkUploaderMap: Map<number, ChunkUploader>;
  CHUNK_SIZE: number = 5 * 1024 * 1024;
  fileUploadSuccessCallback: CallableFunction = () => {};
  fileUploadFailureCallback: CallableFunction = () => {};
  deliveredSet: Set<number> = new Set<number>();

  constructor(file: File) {
    this.file = file;
    this.uploadId = "";
    this.numberOfChunks = 0;
    this.deliveredChunks = [];
    this.chunkUploaderIndexToChunkUploaderMap = new Map<
      number,
      ChunkUploader
    >();

    window.addEventListener("offline", () => {
      this.handleUploadInterrupt();
    });
  }

  async uploadFile(
    fileUploadSuccessCallback: CallableFunction,
    fileUploadFailureCallback: CallableFunction
  ) {
    this.numberOfChunks =
      Math.floor(this.file.size / this.CHUNK_SIZE) +
      (this.file.size % this.CHUNK_SIZE === 0 ? 0 : 1);

    this.fileUploadSuccessCallback = fileUploadSuccessCallback;
    this.fileUploadFailureCallback = fileUploadFailureCallback;

    await this.beginMultipartUploadAtS3();

    if (!this.uploadId) {
      throw new Error("Error starting multipart upload");
    }

    const preSignedUrls: Record<number, string> = await this.getPreSignedUrls();
    console.log(preSignedUrls[0]);
    let start: number = 0,
      end: number = 0;

    for (let i: number = 0; i < this.numberOfChunks; ++i) {
      start = i * this.CHUNK_SIZE;
      end = (i + 1) * this.CHUNK_SIZE;

      let chunkUploader: ChunkUploader = new ChunkUploader(
        preSignedUrls[i] || "",
        i + 1,
        start,
        end,
        this.file
      );

      this.chunkUploaderIndexToChunkUploaderMap.set(
        chunkUploader.index,
        chunkUploader
      );
    }

    this.startUploads(fileUploadSuccessCallback);
  }

  async beginMultipartUploadAtS3(): Promise<void> {
    console.log(process.env.REACT_APP_S3_BUCKET);
    const response = await axios.get(
      "https://75poi4in04.execute-api.us-east-1.amazonaws.com/test/create-multipart-upload",
      {
        params: {
          bucket: process.env.REACT_APP_S3_BUCKET,
          objectName: this.file.name,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error("Multipart upload could not be started");
    } else {
      console.log("Upload id", this.uploadId);
      this.uploadId = response.data.uploadId;
      return;
    }
  }

  async getPreSignedUrls(): Promise<Record<number, string>> {
    try {
      if (!this.uploadId) {
        throw new Error("Upload Id not found");
      }

      if (!this.file) {
        throw new Error("File not found");
      }

      console.log("bucket: ", process.env.REACT_APP_S3_BUCKET);
      const params: PresignedUrlsRequestParams = {
        bucket: process.env.REACT_APP_S3_BUCKET || "",
        uploadId: this.uploadId,
        numberOfChunks: this.numberOfChunks,
        objectName: this.file.name,
        expires: PRESIGNED_URLS_EXPIRY,
      };

      console.log("params, ", params);

      console.log(
        "multipart upload lambda url " +
          process.env.REACT_APP_MULTIPART_UPLOAD_APIS
      );
      const response: AxiosResponse = await axios.get(
        process.env.REACT_APP_MULTIPART_UPLOAD_APIS + "/get-presigned-urls",
        {
          params,
        }
      );

      if (response.status !== 200) {
        throw new Error("Presigned urls could not be fetched");
      }

      return response.data.preSignedUrls;
    } catch (error: Error | unknown) {
      console.log(error);
      throw error;
    }
  }

  async completeMultipartUpload() {
    try {
      // will need to be retried
      const params = {
        bucket: process.env.REACT_APP_S3_BUCKET || "",
        objectName: this.file.name,
        uploadId: this.uploadId,
        parts: this.deliveredChunks.sort(
          (a: CompletedUpload, b: CompletedUpload) =>
            a.PartNumber - b.PartNumber
        ),
      };

      const response: AxiosResponse = await axios.post(
        process.env.REACT_APP_MULTIPART_UPLOAD_APIS +
          "/complete-multipart-upload",
        params
      );

      if (response.status !== 200) {
        throw new Error("Upload could not be completed");
      }

      console.log("Multipart upload completed");
    } catch (error: Error | unknown) {
      console.log("Multipart upload termination failed");
    }
  }

  handleUploadInterrupt(): void {
    window.addEventListener("online", () => this.resumeUpload());
  }

  resumeUpload(): void {
    console.log("Resuming uploads");
    this.startUploads(this.fileUploadSuccessCallback);
  }

  async startUploads(fileUploadSuccessCallback: CallableFunction) {
    const chunkDeliverySuccessCallback = (index: number, etag: string) => {
      console.log("Chunk ", index, " delivered");

      if (this.deliveredSet.has(index)) {
        console.log(index, " being repeated");
        return;
      } else {
        this.deliveredSet.add(index);
      }

      // fetch the chunk uploader from the map and update the status
      let chunkUploader: ChunkUploader | undefined =
        this.chunkUploaderIndexToChunkUploaderMap.get(index);

      if (!chunkUploader) {
        console.log("Chunk not found");
        return;
      }

      this.deliveredChunks.push({
        ETag: chunkUploader.etag,
        PartNumber: chunkUploader.index,
      });
      console.log(
        "Pushing chunk: ",
        chunkUploader.etag,
        "- ",
        chunkUploader.index
      );

      this.chunkUploaderIndexToChunkUploaderMap.set(index, chunkUploader);
      console.log(
        "Delivered chunks: ",
        this.deliveredChunks.length,
        ", numberOfChunks: ",
        this.numberOfChunks
      );
      if (this.deliveredChunks.length === this.numberOfChunks) {
        this.completeMultipartUpload();
        fileUploadSuccessCallback();
      }
    };

    const chunkDeliveryFailureCallback = (chunkUploader: ChunkUploader) => {
      if (chunkUploader.retryInterval > MAX_RETRY_INTERVAL) {
        console.log(
          "Chunk of index: ",
          chunkUploader.index,
          " failed too many times! Resetting retry interval"
        );

        //discuss the retry strategy
        chunkUploader.retryInterval = 1_000;
      }

      chunkUploader.retryInterval *= 2;
      // setTimeout(
      //   chunkUploader.upload.bind(
      //     chunkDeliverySuccessCallback,
      //     chunkDeliveryFailureCallback
      //   ),
      //   chunkUploader.retryInterval
      // );

      setTimeout(
        () =>
          chunkUploader.upload(
            chunkDeliverySuccessCallback,
            chunkDeliveryFailureCallback
          ),
        chunkUploader.retryInterval
      );
    };

    this.chunkUploaderIndexToChunkUploaderMap.forEach(
      (chunkUploader: ChunkUploader, index: number) => {
        if (!chunkUploader.completed) {
          chunkUploader.upload(
            chunkDeliverySuccessCallback,
            chunkDeliveryFailureCallback
          );
        }
      }
    );
  }
}
