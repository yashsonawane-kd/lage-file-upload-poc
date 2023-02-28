import axios from 'axios';
import { getPreSignedUrls } from './presigned-urls-stub';
import { AWSError } from 'aws-sdk';
import AWS from "aws-sdk";
import { CompletedUpload } from './types';


export class LargeFileUploader {

    s3: AWS.S3;
    file: File;
    uploadId: string;
    numberOfChunks: number;
    chunkPromises: Promise<ChunkUploader>[];
    deliveredChunks: CompletedUpload[];
    failedChunks: ChunkUploader[];
    CHUNK_SIZE: number = 5 * 1e+6;

    constructor(s3: AWS.S3, file: File) {
        this.s3 = s3;
        this.file = file;
        this.uploadId = '';
        this.numberOfChunks = 0;
        this.chunkPromises = [];
        this.failedChunks = [];
        this.deliveredChunks = [];
    }

    async beginMultipartUpload() {
        const multipartUpload = await this.s3.createMultipartUpload({Bucket: process.env.REACT_APP_S3_BUCKET || '', Key: this.file.name}).promise();

        if(multipartUpload.UploadId) {
            this.uploadId = multipartUpload.UploadId;
            console.log("Multipart upload created");
        } else {
            console.log("Multipart file upload operation not started by S3");
            return;
        }
    }

    async completeMultipartUpload() {
        try {
            // will need to be retried
            const params = {
                Bucket: process.env.REACT_APP_S3_BUCKET || '',
                Key: this.file.name,
                UploadId: this.uploadId,
                MultipartUpload: { Parts: this.deliveredChunks.sort((a: CompletedUpload, b: CompletedUpload) => a.PartNumber - b.PartNumber) }
            }
            
            this.s3.completeMultipartUpload(params, (error: AWSError, data: AWS.S3.CompleteMultipartUploadOutput) => {
                console.log(error);
                console.log(data);
                console.log("Error while completing upload");
            });
            console.log("Multipart upload completed");
        } catch(error: Error | unknown) {
            console.log("Multipart upload termination failed");
        }
    }

    async uploadFile(fileUploadSuccessCallback: CallableFunction, failure: CallableFunction) {
        this.numberOfChunks = Math.ceil((this.file.size / this.CHUNK_SIZE)) + (this.file.size % this.CHUNK_SIZE === 0? 0 : 1);

        await this.beginMultipartUpload();

        if(!this.uploadId) {
            console.log("Error starting multipart upload");
            return;
        }
        
        const presignedUrls: Record<number, string> = await getPreSignedUrls(this.s3, this.uploadId, this.numberOfChunks, this.file.name);
        console.log(presignedUrls);

        let start: number = 0, end: number = 0;

        const chunkDeliverySuccessCallback = (index: number, etag: string) => { 
            this.deliveredChunks.push({PartNumber: index + 1, ETag: etag});

            console.log("Delivered chunks: ", this.deliveredChunks.length, ", numberOfChunks: ", this.numberOfChunks);

            if(this.deliveredChunks.length === this.numberOfChunks) {
                console.log(this.deliveredChunks);
                this.completeMultipartUpload();
                fileUploadSuccessCallback();
            }
        };
        const chunkDeliveryFailureCallback = (chunkUploader: ChunkUploader) => { this.failedChunks.push(chunkUploader) };

        for(let i: number = 0; i < this.numberOfChunks; ++i) {
            start = i * this.CHUNK_SIZE;
            end = (i + 1) * this.CHUNK_SIZE;

            this.chunkPromises.push(
                (new ChunkUploader(presignedUrls[i] || '', i, start, end, this.file)).upload(chunkDeliverySuccessCallback, chunkDeliveryFailureCallback)
            );
        }
    
        
    }
}

export class ChunkUploader {
    presignedUrl: string;
    etag: string;
    index: number;
    start: number;
    end: number;
    file: File;
    completed: boolean;
    
    constructor(presignedUrl: string, index: number, start: number, end: number, file: File) {
        console.log("Chunk created for start: ", start, " end: ", end);
        this.presignedUrl = presignedUrl;
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
            console.log("Uploading chunk start: ", this.start, " end: ", this.end);
            const response = await axios.put(this.presignedUrl, fileChunk);
            console.log("Response data for chunk start: ", this.start, " end: ", this.end);
            console.log(response);
            console.log("Headers: ", response.headers);
            this.etag = response.headers.etag;
            this.completed = true;
            console.log("Etag for chunk ", this.index + 1, ": ", this.etag);

            success(this.index, this.etag);
        } catch(error: Error | unknown) {
            this.completed = false;
            console.log("Upload failed for chunk start: ", this.start, " end: ", this.end);
            failure(this);
        }

        return this;
    }
}