import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>This page isn’t available.</h1>
      <Link className="button" href="/">
        Return to overview
      </Link>
    </main>
  );
}
