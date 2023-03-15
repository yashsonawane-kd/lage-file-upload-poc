import React, { ChangeEvent, useState } from "react";
import Button from "@mui/material/Button";
import Input from "@mui/material/Input";
import { LargeFileUploader } from "./LargeFileUploader";

const FileUploader: React.FC = () => {
  // file to upload
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  const uploadSmallFile = async (): Promise<void> => {
    if (!selectedFile) {
      return;
    }

    //TODO: change this call
    // const presignedUrl: string | null = getPreSignedUrl(selectedFile.name);

    // if (!presignedUrl) {
    //   console.log("File upload failed");
    //   return;
    // }

    // try {
    //   console.log(presignedUrl);
    //   const response = await axios.put(presignedUrl, selectedFile);
    //   console.log(response);
    // } catch (error: Error | unknown) {
    //   console.log("Failed upload with presigned url");
    //   console.log(error);
    // }
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
