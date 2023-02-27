import React, { ChangeEvent, useState } from 'react';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';
import AWS from "aws-sdk";
import axios from 'axios';


const FileUploader: React.FC = () => {

  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const S3_BUCKET: string = "large-file-upload-poc1";
  // const bucketUrl: string = process.env.REACT_APP_S3_URL ?? '';
  const accessKeyId: string | undefined = process.env.REACT_APP_ACCESS_KEY_ID || '';
  const secretAccessKey: string | undefined = process.env.REACT_APP_SECRET_ACCESS_KEY || '';
  const sessionToken: string | undefined = process.env.REACT_APP_SESSION_TOKEN || '';

  if(!(accessKeyId || secretAccessKey || sessionToken)) {
    console.log("Could not fetch AWS creds");
  }

  const s3: AWS.S3 = new AWS.S3({
    credentials: new AWS.Credentials(accessKeyId, secretAccessKey, sessionToken),
    signatureVersion: 'v4'
  });


  // TODO
  // Perform the logic to determine file size
  // Perform the logic to upload file to AWS S3
  // To consider upload interruptions and other scenarios
  
  const getPreSignedUrl = (filename: string): string | null => {
    console.log(filename);
    try {
      return s3.getSignedUrl('putObject', {
        Bucket: S3_BUCKET,
        Key: filename,
        Expires: 120000
      });
    } catch(error: Error | any) {
      console.log("Error while getting pre-signed urls");
      console.log(error);
      return null;
    }
  }

  const getPreSignedUrls = async (s3: AWS.S3, uploadId: string, chunks: number, filename: string) => {
    const baseParams = {
      Bucket: S3_BUCKET,
      Key: filename,
      UploadId: uploadId
    };
  
    const promises: Promise<string>[] = [];
  
    for (let index = 0; index < chunks; index++) {
      promises.push(
        s3.getSignedUrlPromise('uploadPart', {
        ...baseParams,
        PartNumber: index + 1
      }));
    }
  
    const res = await Promise.all(promises);
  
    return res.reduce((map, chunk, index) => {
      map[index] = chunk;
      return map
    }, {} as Record<number, string>);
  }

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file);
  };

  const uploadSmallFile = async () => {
    if(!selectedFile) {
      return;
    }

    const presignedUrl: string | null = await getPreSignedUrl(selectedFile.name);

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