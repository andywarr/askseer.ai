import Link from "next/link";

export default function AuthError({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams?.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-md">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Authentication Error
          </h1>

          {error === "OAuthAccountNotLinked" && (
            <div className="space-y-4">
              <p className="text-gray-600">
                This email address is already associated with another sign-in
                method.
              </p>
              <p className="text-sm text-gray-500">
                Please sign in using the same method you used before, or contact
                support if you need help linking your accounts.
              </p>
            </div>
          )}

          {error === "OAuthCallback" && (
            <div className="space-y-4">
              <p className="text-gray-600">
                There was an error with the OAuth callback.
              </p>
              <p className="text-sm text-gray-500">
                Please try signing in again.
              </p>
            </div>
          )}

          {error &&
            error !== "OAuthAccountNotLinked" &&
            error !== "OAuthCallback" && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  An error occurred during authentication.
                </p>
                <p className="text-sm text-gray-500">Error: {error}</p>
              </div>
            )}

          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
