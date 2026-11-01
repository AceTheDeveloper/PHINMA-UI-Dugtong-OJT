"use client";

import { useState } from "react";
import Link from "next/link";
import { primaryAction } from "@/components/auth/auth-parts";
import { focusStyle } from "@/components/brand-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Mock: accepting only moves on. Recording consent happens in ticket-09.
export function ConsentForm() {
  const [agreed, setAgreed] = useState(false);

  return (
    <div>
      <div className="mt-7 flex items-start gap-3">
        <input
          id="agree"
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
          className={cn(
            "mt-0.5 size-[22px] shrink-0 cursor-pointer accent-primary",
            focusStyle,
          )}
        />
        <label
          htmlFor="agree"
          className="cursor-pointer text-[15px] leading-[1.6]"
        >
          I have read how my data is used and I agree.
        </label>
      </div>

      <div className="mt-7">
        {agreed ? (
          <Button
            nativeButton={false}
            render={<Link href="/" />}
            role="link"
            size="lg"
            className={primaryAction}
          >
            Accept and continue
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            disabled
            className={cn(primaryAction, "opacity-45")}
          >
            Accept and continue
          </Button>
        )}
      </div>
    </div>
  );
}
