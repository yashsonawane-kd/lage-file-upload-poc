export const getPreSignedUrls = async (s3: AWS.S3, uploadId: string, chunksCount: number, filename: string): Promise<Map<number, string>> => {
    const baseParams = {
        Bucket: process.env.S3_BUCKET || '',
      Key: filename,
      UploadId: uploadId
    };
  
    const promises: Promise<string>[] = [];
  
    for (let index = 0; index < chunksCount; index++) {
      promises.push(
        s3.getSignedUrlPromise('uploadPart', {
        ...baseParams,
        PartNumber: index + 1
      }));
    }
  
    const res = await Promise.all(promises);
  
    return res.reduce((map: Map<number, string>, chunk, index) => {
      map.set(index, chunk);
      return map
    }, {} as Map<number, string>);
  }

export const getPreSignedUrl = (s3: AWS.S3, filename: string): string | null => {
    console.log(filename);
    try {
      return s3.getSignedUrl('putObject', {
        Bucket: process.env.REACT_APP_S3_BUCKET,
        Key: filename,
        Expires: 120000
      });
    } catch(error: Error | any) {
      console.log("Error while getting pre-signed urls");
      console.log(error);
      return null;
    }
  }

