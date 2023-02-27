import axios from 'axios';

export class ChunkUploadJob {
    url: string;
    etag: string;
    start: number;
    end: number;
    file: Buffer;
    completed: boolean;
    
    constructor(url: string, start: number, end: number, file: Buffer) {
        this.url = url;
        this.etag = '';
        this.start = start;
        this.end = end;
        this.file = file;
        this.completed = false;
    }

    async upload() {
        const fileChunk: Buffer = this.file.slice(this.start, this.end);

        return await axios.put(this.url, fileChunk);
    }
}