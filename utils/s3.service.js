const AWS = require("aws-sdk");
require("dotenv").config();

AWS_S3_BUCKET = process.env.AWS_S3_BUCKET;
s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: "eu-north-1",
});

const uploadFile = async (file, uuid, folderName, type) => {
  const filePath = `${process.env.AWS_S3_BUCKET}/${folderName}`;
  await s3_upload(file, filePath, uuid || file.originalName, type);

  return {
    uuid: uuid,
    originalName: file.originalName,
    fileType: file.fileType,
    size: file.size,
    encoding: file.encoding,
  };
};

const createBucket = async (bucketName) => {
  const params = {
    Bucket: bucketName + "-keywest",
  };
  return await this.s3.createBucket(params, function (err, data) {
    if (err) console.log(err, err.stack);
    else console.log("Bucket Created Successfully", data.Location);
  });
};

function getPreSignedUrl(key, folderName) {
  const filePath = `${process.env.AWS_S3_BUCKET}/${folderName}`;
  const expirationTime = 7 * 24 * 60 * 60;

  return this.s3.getSignedUrl("getObject", {
    Bucket: filePath,
    Key: key,
    Expires: expirationTime,
  });
}

async function s3_upload(file, bucket, name, mimetype) {
  const params = {
    Bucket: bucket,
    Key: String(name),
    Body: file,
    ContentType: mimetype,
  };

  const s3Response = await this.s3.upload(params).promise();
  return name;
}
module.exports = { uploadFile, getPreSignedUrl };
