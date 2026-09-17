import { notFound } from 'next/navigation';
import Dashboard from '@/components/dashboard';
import { previewSnapshot } from '@/lib/fixtures';
export const dynamic = 'force-dynamic';
export default function Preview() {
  // No auth bypass or fixture mode is available in a production build.
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEV_PREVIEW !== 'true')
    notFound();
  return <Dashboard previewSnapshot={previewSnapshot()} />;
}
