import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageNavProps = {
  /** Where "up" goes when there is no history to go back to. */
  homeTo?: "/spaces" | "/";
  className?: string;
};

/**
 * Small back/home control used on every inner page so keyboard, mouse and
 * touch users always have a way out without the browser chrome.
 */
export function PageNav({ homeTo = "/spaces", className = "" }: PageNavProps) {
  const router = useRouter();

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.history.back()}
        aria-label="Go back"
        className="gap-1.5"
      >
        <ArrowLeft className="size-4" />
        <span className="hidden sm:inline">Back</span>
      </Button>
      <Button variant="ghost" size="sm" asChild aria-label="Go to your spaces" className="gap-1.5">
        <Link to={homeTo}>
          <Home className="size-4" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </Button>
    </div>
  );
}
