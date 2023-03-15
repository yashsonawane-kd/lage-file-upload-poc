import React, { ChangeEvent, useState } from "react";
import Button from "@mui/material/Button";
import Input from "@mui/material/Input";
import { LargeFileUploader } from "./LargeFileUploader";
import axios, { AxiosResponse } from "axios";

const FileUploader: React.FC = () => {
  // file to upload
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const uploadSmallFile = async (): Promise<void> => {
    if (!selectedFile) {
      return;
    }

    const params = {
      bucket: process.env.REACT_APP_S3_BUCKET,
      objectName: selectedFile.name,
      expires: 12000,
    };

    const preSignedUrlResponse: AxiosResponse = await axios.get(
      process.env.REACT_APP_MULTIPART_UPLOAD_APIS + "/get-presigned-url",
      { params: params }
    );

    const preSignedUrl: string = preSignedUrlResponse.data.preSignedUrl;

    console.log(preSignedUrl);

    await axios.put(preSignedUrl, selectedFile, {
      transformRequest: (data, headers) => {
        delete headers["Content-Type"];
        return data;
      },
    });
  };

  const uploadLargeFile = async () => {
    if (!selectedFile) {
      console.log("File not selected");
      return;
    }

    let largeFileUploader: LargeFileUploader = new LargeFileUploader(
      selectedFile
    );

    await largeFileUploader.uploadFile(
      () => console.log("Success"),
      () => console.log("Failure")
    );
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    console.log("Handling upload");
    if (selectedFile) {
      if (selectedFile.size < 5 * 1024) {
        console.log("Uploading small file");
        uploadSmallFile();
      } else {
        await uploadLargeFile();
      }
    }
  };

  return (
    <div>
      <Input
        type="file"
        onChange={handleFileSelect}
        sx={{ marginRight: "20px" }}
      ></Input>
      <Button variant="contained" color="success" onClick={handleUpload}>
        Upload
      </Button>
    </div>
  );
};

export default FileUploader;
