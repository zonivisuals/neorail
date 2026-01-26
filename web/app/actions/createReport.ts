"use server";

import { prismaClient as prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

type CreateReportResult = 
  | { success: true; reportId: string }
  | { success: false; error: string };


export async function createReport(
  formData: FormData, 
  imageUrl: string
): Promise<CreateReportResult> {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      redirect("/login");
    }

    // 2. Validate and extract form data
    const content = formData.get("content") as string;
    const location = formData.get("location") as string;
    const urgency = formData.get("urgency") as string;

    // Validate required fields
    if (!content || !location || !urgency) {
      return {
        success: false,
        error: "Missing required fields: content, location, or urgency",
      };
    }

    // Validate urgency enum
    if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(urgency)) {
      return {
        success: false,
        error: "Invalid urgency level",
      };
    }

    // 3. Get the current user (conductor only)
    const conductor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!conductor) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Only conductors can create reports
    if (conductor.role !== "CONDUCTOR") {
      return {
        success: false,
        error: "Only conductors can create reports",
      };
    }

    // 4. Create the Report in database
    const report = await prisma.report.create({
      data: {
        content,
        location,
        urgency: urgency as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        imageUrl: [imageUrl],
        status: "OPEN",
        conductorId: conductor.id,
      },
      select: {
        id: true,
      },
    });

    return { 
      success: true, 
      reportId: report.id 
    };
  } catch (error) {
    console.error("Error creating report:", error);
    return {
      success: false,
      error: "Failed to create report. Please try again.",
    };
  }
}