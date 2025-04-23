// AWS imports
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

// Interfaces
export interface File {
  id: string;
  name: string;
  key: string | null;
  size: number;
  type: string;
}

// Get files for a study
export async function getFiles(studyId: string) {
  // Get files
  const response = await fetch(
    `${process.env.DB_WORKER_URL}/api/files?studyId=${studyId}`
  );
  const { data: files } = await response.json();

  return files;
}

// Get a presigned URL for a file in S3
export async function getPresignedUrl(key: string) {
  const s3Client = new S3Client({ region: process.env.AWS_REGION });

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key, // Path to your image in S3
  });

  try {
    // Generate a pre-signed URL valid for 1 hour (3600 seconds)
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return url;
  } catch (error) {
    console.error("Error generating pre-signed URL", error);
    throw error;
  }
}

// Update user credits
export async function updateCredits(userId: string, credits: number) {
  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/updateCredits`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: userId, delta: credits }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating credits:", error);
    throw error;
  }
}

// Update study status
export async function updateStatus(studyId: string, status: string) {
  try {
    const response = await fetch(
      `${process.env.DB_WORKER_URL}/api/studyStatus`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ studyId: studyId, status: status }),
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error updating study status:", error);
    throw error;
  }
}
