import { Download } from "lucide-react";
import { focusStyle } from "@/components/brand-link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// A link that downloads a file from one of the signed-in export routes. A plain
// anchor, not the client router: the file is a download, not a page.

export function DownloadButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      download
      className={cn(buttonVariants({ variant: "outline" }), "h-11 px-4", focusStyle, className)}
    >
      <Download aria-hidden="true" className="size-4" />
      {children}
    </a>
  );
}

// The same, as a quiet text link for a table row. 44 px high on touch screens.
export function DtrLink({ deploymentId, name }: { deploymentId: string; name: string }) {
  return (
    <a
      href={`/dtr/${deploymentId}/pdf`}
      download
      aria-label={`Download the DTR of ${name}`}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-md px-1.5 text-sm font-semibold text-primary hover:bg-primary-tint pointer-coarse:min-h-11",
        focusStyle,
      )}
    >
      <Download aria-hidden="true" className="size-4" />
      DTR
    </a>
  );
}
