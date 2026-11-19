import { PageSkeleton } from "@/components/skeletons";

/**
 * Route-level loading state. Next.js shows this while a page's data is being
 * fetched, so navigation never flashes an empty frame.
 */
export default function AppLoading() {
  return <PageSkeleton />;
}
