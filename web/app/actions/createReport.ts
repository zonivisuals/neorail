"use server";

import { prismaClient as prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createReportSchema,
  imageDataUrlsSchema,
  type CreateReportInput,
} from "@/lib/validations/reportSchema";
import { z } from "zod";

type CreateReportResult =
  | { success: true; reportId: string }
  | { success: false; error: string };


async function uploadImagesToStorage(
  imageDataUrls: string[],
  userId: string
): Promise<string[]> {
  const supabase = createServiceClient();
  const uploadedUrls: string[] = [];

  for (let i = 0; i < imageDataUrls.length; i++) {
    const dataUrl = imageDataUrls[i];

    // Extract base64 data and MIME type
    const base64Data = dataUrl.split(",")[1];
    const mimeType =
      dataUrl.split(",")[0].match(/:(.*?);/)?.[1] || "image/png";
    const buffer = Buffer.from(base64Data, "base64");

    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = mimeType.split("/")[1];
    const filename = `reports/${userId}/${timestamp}-${randomId}.${extension}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from("report_images")
      .upload(filename, buffer, {
        contentType: mimeType,
        cacheControl: "3600",
      });

    if (error) {
      throw new Error(`Failed to upload image ${i + 1}: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("report_images").getPublicUrl(filename);

    uploadedUrls.push(publicUrl);
  }

  return uploadedUrls;
}


export async function createReport(
  formData: FormData,
  imageDataUrls: string[]
): Promise<CreateReportResult> {
  console.log("[createReport] Starting report creation");

  try {
    // 1. Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      redirect("/login");
    }

    // 2. Validate form data with Zod
    const formInput = {
      content: formData.get("content"),
      location: formData.get("location"),
      urgency: formData.get("urgency"),
    };

    let validatedData: CreateReportInput;
    try {
      validatedData = createReportSchema.parse(formInput);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return {
          success: false,
          error: firstError?.message || "Invalid form data",
        };
      }
      throw error;
    }

    // 3. Validate images with Zod
    try {
      imageDataUrlsSchema.parse(imageDataUrls);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.issues[0];
        return {
          success: false,
          error: firstError?.message || "Invalid image data",
        };
      }
      throw error;
    }

    // 4. Get conductor with trainId
    const conductor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        trainId: true,
      },
    });

    if (!conductor) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (conductor.role !== "CONDUCTOR") {
      return {
        success: false,
        error: "Only conductors can create reports",
      };
    }

    // 5. Upload images to Supabase Storage (if any)
    let uploadedImageUrls: string[] = [];

    if (imageDataUrls.length > 0) {
      try {
        uploadedImageUrls = await uploadImagesToStorage(
          imageDataUrls,
          conductor.id
        );
        console.log(
          `[createReport] Uploaded ${uploadedImageUrls.length} images`
        );
      } catch (error) {
        console.error("[createReport] Image upload error:", error);
        return {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to upload images",
        };
      }
    }

    // 6. Create the Report in database with trainId
    // @ts-ignore - Prisma 7 adapter causes type narrowing issues
    const report = await prisma.report.create({
      data: {
        content: validatedData.content,
        location: validatedData.location,
        urgency: validatedData.urgency,
        imageUrl: uploadedImageUrls,
        trainId: conductor.trainId,
        status: "OPEN",
        conductorId: conductor.id,
      },
      select: {
        id: true,
        createdAt: true,
        urgency: true,
        status: true,
        trainId: true,
      },
    });

    console.log(`[createReport] Report created successfully:`, {
      reportId: report.id,
      conductorId: conductor.id,
      trainId: report.trainId,
      urgency: report.urgency,
      imagesCount: uploadedImageUrls.length,
      createdAt: report.createdAt,
    });

    return { 
      success: true, 
      reportId: report.id 
    };
  } catch (error) {
    console.error("[createReport] Error creating report:", error);
    
    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes('Foreign key constraint')) {
        return {
          success: false,
          error: "Invalid user reference. Please try logging in again.",
        };
      }
      
      if (error.message.includes('Unique constraint')) {
        return {
          success: false,
          error: "Duplicate report detected. Please refresh and try again.",
        };
      }
    }
    
    return {
      success: false,
      error: "Failed to create report. Please try again.",
    };
  }
}