import axios from "axios";

export class ChunkUploader {
  presignedUrl: string;
  etag: string;
  index: number;
  start: number;
  end: number;
  file: File;
  completed: boolean;
  retryInterval: number = 1_000;

  constructor(
    presignedUrl: string,
    index: number,
    start: number,
    end: number,
    file: File
  ) {
    this.presignedUrl = presignedUrl;
    this.etag = "";
    this.index = index;
    this.start = start;
    this.end = end;
    this.file = file;
    this.completed = false;
  }

  async upload(
    success: CallableFunction,
    failure: CallableFunction
  ): Promise<ChunkUploader> {
    const fileChunk: Blob = this.file.slice(this.start, this.end);
    console.log("Uploading chunk ", this.index, " of size ", fileChunk.size);

    try {
      const response = await axios.put(this.presignedUrl, fileChunk, {
        transformRequest: (data, headers) => {
          delete headers["Content-Type"];
          return data;
        },
      });
      this.etag = response.headers.etag
        .replaceAll('"', "")
        .replaceAll("\\", "");
      this.completed = true;
      success(this.index, this.etag);
    } catch (error: Error | unknown) {
      this.completed = false;
      console.log("Upload failed for chunk: ", this.index);
      console.log(error);
      failure(this);
    }

    return this;
  }
}
