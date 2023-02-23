import React, { ChangeEvent, useState } from 'react';
import Button from '@mui/material/Button';
import Input from '@mui/material/Input';

const FileUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);

  // TODO
  // Perform the logic to determine file size
  // Perform the logic to upload file to AWS S3
  // To consider upload interruptions and other scenarios
  
  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      console.log(`Uploading file: ${selectedFile.name}`);
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