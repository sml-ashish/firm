"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

/**
 * Route-level error boundary. Keeps the shell (sidebar, top bar, footer) in
 * place and offers a retry without a full reload.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page could not be loaded"
      description="The data request failed. Retry the page. If the problem continues, check the database connection or contact the FIRM administrator."
      detail={error.digest ?? error.message}
      action={
        <button type="button" className="btn btn-primary" onClick={reset}>
          Retry
        </button>
      }
    />
  );
}
