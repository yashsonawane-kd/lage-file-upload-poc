import { ChunkUploader } from "./chunk-uploader";

export class ChunkUploaderPool {

    poolCapacity: number = 200;
    uploaderPool: Set<number>;

    constructor() {
        this.uploaderPool = new Set<number>();
    }

    isFull(): boolean {
        return this.uploaderPool.size >= this.poolCapacity;
    }

    addToPool(chunkUploader: ChunkUploader, successCallback: CallableFunction, failureCallback: CallableFunction): void {

        if(this.uploaderPool.size >= this.poolCapacity) {
            throw new Error("Pool at capacity!");
        }

        this.uploaderPool.add(chunkUploader.index);
        chunkUploader.upload(successCallback, failureCallback);
    }

    removeFromPool(chunkIndex: number): void {
        if(this.uploaderPool.size === 0) {
            throw new Error("Pool empty");
        }

        this.uploaderPool.delete(chunkIndex);
    }

}







