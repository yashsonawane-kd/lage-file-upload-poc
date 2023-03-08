import { getPreSignedUrls } from './presigned-urls-stub';
import { AWSError } from 'aws-sdk';
import AWS from "aws-sdk";
import { CompletedUpload } from './types';
import { MAX_RETRY_INTERVAL } from './constants';
import { ChunkUploader } from "./ChunkUploader";


export class LargeFileUploader {

    s3: AWS.S3;
    file: File;
    uploadId: string;
    numberOfChunks: number;
    //may not be necessary
    deliveredChunks: CompletedUpload[];
    chunkUploaderIndexToChunkUploaderMap: Map<number, ChunkUploader>;
    CHUNK_SIZE: number = 5 * 1024 * 1024;

    fileUploadSuccessCallback: CallableFunction = () => {};
    fileUploadFailureCallback: CallableFunction = () => {};

    // for testing
    deliveredSet: Set<number> = new Set<number>();

    constructor(s3: AWS.S3, file: File) {
        this.s3 = s3;
        this.file = file;
        this.uploadId = '';
        this.numberOfChunks = 0;
        this.deliveredChunks = [];
        this.chunkUploaderIndexToChunkUploaderMap = new Map<number, ChunkUploader>();

        window.addEventListener("offline", () => {
            this.handleUploadInterrupt();
        });
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
            
            this.s3.completeMultipartUpload(params, (error: AWSError, data: AWS.S3.CompleteMultipartUploadOutput) => { throw new Error("Failed to complete multipart upload") });
            console.log("Multipart upload completed");
        } catch(error: Error | unknown) {
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
    
            if(this.deliveredSet.has(index)) {
                console.log(index, " being repeated");
                return;
            } else {
                this.deliveredSet.add(index);
            }

            // fetch the chunk uploader from the map and update the status
            let chunkUploader: ChunkUploader | undefined = this.chunkUploaderIndexToChunkUploaderMap.get(index);
    
            if(!chunkUploader) {
                console.log("Chunk not found");
                return;
            }
    
            this.deliveredChunks.push({ETag: chunkUploader.etag, PartNumber: chunkUploader.index });

            this.chunkUploaderIndexToChunkUploaderMap.set(index, chunkUploader); 
            console.log("Delivered chunks: ", this.deliveredChunks.length, ", numberOfChunks: ", this.numberOfChunks);
            if(this.deliveredChunks.length === this.numberOfChunks) {
                this.completeMultipartUpload();
                fileUploadSuccessCallback();
            }
        };
    
        const chunkDeliveryFailureCallback = (chunkUploader: ChunkUploader) =>{ 
    
            if(chunkUploader.retryInterval > MAX_RETRY_INTERVAL) {
                console.log("Chunk of index: ", chunkUploader.index, " failed too many times! Resetting retry interval");
    
                //discuss the retry strategy
                chunkUploader.retryInterval = 1_000;
            }
    
            chunkUploader.retryInterval *= 2;
            setTimeout(chunkUploader.upload.bind(chunkDeliverySuccessCallback, chunkDeliveryFailureCallback), chunkUploader.retryInterval);
        };

        console.log("Map size: ", this.chunkUploaderIndexToChunkUploaderMap.size);
        console.log("Delivered chunks: ", this.deliveredChunks.length);

        this.chunkUploaderIndexToChunkUploaderMap.forEach( (chunkUploader: ChunkUploader, index: number) => {
            if(!chunkUploader.completed) {
                chunkUploader.upload(chunkDeliverySuccessCallback, chunkDeliveryFailureCallback);
            }
        })
    }

    async uploadFile(fileUploadSuccessCallback: CallableFunction, fileUploadFailureCallback: CallableFunction) {
        this.numberOfChunks = Math.floor((this.file.size / this.CHUNK_SIZE)) + (this.file.size % this.CHUNK_SIZE === 0? 0 : 1);

        this.fileUploadSuccessCallback = fileUploadSuccessCallback;
        this.fileUploadFailureCallback = fileUploadFailureCallback;

        await this.beginMultipartUpload();

        if(!this.uploadId) {
            console.log("Error starting multipart upload");
            return;
        }
        
        const presignedUrls: Record<number, string> = await getPreSignedUrls(this.s3, this.uploadId, this.numberOfChunks, this.file.name);

        let start: number = 0, end: number = 0;

        

        for(let i: number = 0; i < this.numberOfChunks; ++i) {
            start = i * this.CHUNK_SIZE;
            end = (i + 1) * this.CHUNK_SIZE;

            let chunkUploader: ChunkUploader = new ChunkUploader(presignedUrls[i] || '', i + 1, start, end, this.file);

            this.chunkUploaderIndexToChunkUploaderMap.set(chunkUploader.index, chunkUploader);
        }
    
        this.startUploads(fileUploadSuccessCallback);
    }

}
