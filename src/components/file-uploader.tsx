import React, { ChangeEvent, useState } from 'react';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';
import AWS, { S3 } from "aws-sdk";
import axios from 'axios';
import { getPreSignedUrl, getPreSignedUrls } from './presigned-urls-stub';


const FileUploader: React.FC = () => {

  // file to upload
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  //constants
  const S3_BUCKET: string = process.env.S3_BUCKET || '';
  const accessKeyId: string | undefined = process.env.REACT_APP_ACCESS_KEY_ID || '';
  const secretAccessKey: string | undefined = process.env.REACT_APP_SECRET_ACCESS_KEY || '';
  const sessionToken: string | undefined = process.env.REACT_APP_SESSION_TOKEN || '';

  // S3 object for interacting with S3
  const s3: AWS.S3 = new AWS.S3({
    credentials: new AWS.Credentials(accessKeyId, secretAccessKey, sessionToken),
    signatureVersion: 'v4'
  });


  // TODO
  // Perform the logic to determine file size
  // Perform the logic to upload file to AWS S3
  // To consider upload interruptions and other scenarios

  const uploadSmallFile = async () => {
    if(!selectedFile) {
      return;
    }

    const presignedUrl: string | null = getPreSignedUrl(s3, selectedFile.name);

    if(!presignedUrl) {
      console.log("File upload failed");
      return;
    }

    try {
      console.log(presignedUrl);
      const response = await axios.put(presignedUrl, selectedFile);
      console.log(response);
    }catch(error: Error | unknown) {
      console.log('Failed upload with presigned url');
      console.log(error);
    }
  }

  const uploadLargeFile = async (file: Buffer) => {

    // if(!selectedFile) {
    //   console.log("Cannot complete large file upload, no file selected");
    //   return;
    // }

    // //creating a multipart upload
    // const multipartUpload = await s3.createMultipartUpload({Bucket: S3_BUCKET, Key: file.name}).promise();

    // const uploadId: string | undefined = multipartUpload.UploadId;

    // if(!uploadId) {
    //   console.log("Error starting multipart upload");
    //   return '';
    // }
    // let chunksCount: number = (selectedFile.size / 5) + (selectedFile.size % 5 * 1e+6 == 0 ? 0 : 1);

    // const chunkNumberToPresignedUrlMap: Map<number, string> | null = await getPreSignedUrls(s3, uploadId, chunksCount, selectedFile.name);

    // // for(chun)
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    console.log("Handling upload");
    if (selectedFile) {
      if(selectedFile.size < 5*1024) {
        console.log("Uploading small file");
        uploadSmallFile();
      }      
    }
  };

  return (
    <div>
      <Input type="file" onChange={handleFileSelect} sx={{marginRight: '20px'}}></Input>
      <Button variant="contained" color="success" onClick={handleUpload}>Upload</Button>
    </div>
  );
};

export default FileUploader;