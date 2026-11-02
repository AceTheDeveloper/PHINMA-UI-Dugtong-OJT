"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { getResumeLink } from "@/app/(app)/student/resume/actions";
import { FormMessage } from "@/components/admin/form-parts";
import { Button } from "@/components/ui/button";

// Opens a student's resume through the short-lived signed link. The action checks
// the coordinator's role, and the database checks the student is in their course.

const unexpected = "Something went wrong. Try again in a moment.";

export function ResumeButton({ studentId, hasResume }: { studentId: string; hasResume: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={pending || !hasResume}
        className="h-11 w-fit px-4"
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await getResumeLink({ studentId });
              if (!result.ok) {
                setMessage(result.error.message);
                return;
              }
              window.open(result.data, "_blank", "noopener,noreferrer");
            } catch {
              setMessage(unexpected);
            }
          });
        }}
      >
        <ExternalLink aria-hidden="true" className="size-4" />
        {hasResume ? "Open resume" : "No resume yet"}
      </Button>
      <FormMessage message={message} />
    </div>
  );
}
