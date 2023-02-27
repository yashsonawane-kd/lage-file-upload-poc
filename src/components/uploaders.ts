import axios from 'axios';
import { getPreSignedUrls } from './presigned-urls-stub';


export class LargeFileUploader {

    s3: AWS.S3;
    file: File;
    chunkPromises: Promise<ChunkUploader>[];
    deliveredChunks: Map<number, string>;
    failedChunks: ChunkUploader[];
    CHUNK_SIZE: number = 5 * 1e+6;

    constructor(s3: AWS.S3, file: File) {
        this.s3 = s3;
        this.file = file;
        this.chunkPromises = [];
        this.failedChunks = [];
        this.deliveredChunks = new Map<number, string>();
    }



    async uploadFile(success: CallableFunction, failure: CallableFunction) {
        const numberOfChunks: number = (this.file.size / this.CHUNK_SIZE) + (this.file.size % this.CHUNK_SIZE === 0? 0 : 1);

        const multipartUpload = await this.s3.createMultipartUpload({Bucket: process.env.S3_BUCKET || '', Key: this.file.name}).promise();

        const uploadId: string | undefined = multipartUpload.UploadId;

        if(!uploadId) {
            console.log("Error starting multipart upload");
            return '';
        }
        
        const presignedUrls: Map<number, string> = await getPreSignedUrls(this.s3, uploadId, numberOfChunks, this.file.name);

        let start: number = 0, end: number = 0;

        const chunkDeliverySuccessCallback = (index: number, etag: string) => { this.deliveredChunks.set(index, etag) };
        const chunkDeliveryFailureCallback = (chunkUploader: ChunkUploader) => { this.failedChunks.push(chunkUploader) };

        for(let i: number = 0; i < numberOfChunks; ++i) {
            start = numberOfChunks * this.CHUNK_SIZE;
            end = (numberOfChunks + 1) + this.CHUNK_SIZE;

            this.chunkPromises.push(
                (new ChunkUploader(presignedUrls.get(i) || '', i, start, end, this.file)).upload(chunkDeliverySuccessCallback, chunkDeliveryFailureCallback)
            );
        }
    
        console.log('Failed uploads: ', this.failedChunks.length);
    }
}

export class ChunkUploader {
    url: string;
    etag: string;
    index: number;
    start: number;
    end: number;
    file: File;
    completed: boolean;
    
    constructor(url: string, index: number, start: number, end: number, file: File) {
        this.url = url;
        this.etag = '';
        this.index = index;
        this.start = start;
        this.end = end;
        this.file = file;
        this.completed = false;
    }

    async upload(success: CallableFunction, failure: CallableFunction): Promise<ChunkUploader> {
        const fileChunk: Blob = this.file.slice(this.start, this.end);

        try {
            const response = await axios.put(this.url, fileChunk);
            this.etag = response.data.Etag;
            this.completed = true;

            success(this.index, this.etag);
        } catch(error: Error | unknown) {
            this.completed = false;

            failure(this);
        }

        return this;
    }
}