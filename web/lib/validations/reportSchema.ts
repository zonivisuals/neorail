import { z } from "zod";

export const urgencyEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
  message: "Invalid urgency level",
});


export const createReportSchema = z.object({
  content: z
    .string()
    .min(10, "Report description must be at least 10 characters")
    .max(5000, "Report description is too long (max 5000 characters)")
    .transform((val) => val.trim()),
  
  location: z
    .string()
    .min(1, "Location is required")
    .transform((val) => val.trim()),
  
  urgency: urgencyEnum,
});


export const imageDataUrlsSchema = z
  .array(
    z.string().regex(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, {
      message: "Invalid image format. Only PNG, JPEG, GIF, and WebP are supported",
    })
  )
  .max(3, "Maximum 3 images allowed per report");


export type CreateReportInput = z.infer<typeof createReportSchema>;


export type ImageDataUrls = z.infer<typeof imageDataUrlsSchema>;
