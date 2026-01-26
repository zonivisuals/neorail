"use client";

import { SolutionsProgress } from "@/components/admin/solutions-progress";

export default function AdminDashboardPage() {
  const tasks = [
    {
      id: "1",
      title: "Review Application Documents",
      status: "completed" as const,
      subtitle: "Verified by system",
    },
    {
      id: "2",
      title: "Conduct Safety Interview",
      status: "active" as const,
      subtitle: "Pending your review",
      description: "Please schedule and conduct the mandatory safety interview with the applicant.",
      actionLabel: "Schedule",
      onAction: () => {
        // Open scheduling modal or navigate to scheduling page
        console.log("Schedule interview");
      },
    },
    {
      id: "3",
      title: "Issue Final Clearance Certificate",
      status: "pending" as const,
    },
  ];

  const completedTasks = tasks.filter(t => t.status === "completed").length;

  return (
    <div className="w-screen h-screen flex items-center justify-center">
      <SolutionsProgress 
        tasks={tasks} 
        completedCount={completedTasks} 
        totalCount={tasks.length} 
      />
    </div>
  );
}