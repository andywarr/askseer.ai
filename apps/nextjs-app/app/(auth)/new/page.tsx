// Next imports
import Link from "next/link";

// Lib functions imports
import { isAuthenticated } from "@/apps/nextjs-app/lib/dal";

// Lib functions imports
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/apps/nextjs-app/components/ui/card";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";

export default async function Page() {
  const session = await isAuthenticated();

  return (
    <div>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Unlock Insights
      </h2>
      <p className="mb-4">
        Select an AI-assisted research study that best suits your needs to
        unlock insights.
      </p>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns:
            "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
        }}
      >
        <Link href="/walkthrough/new">
          <Card className="h-full w-full hover:border-black">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center justify-between">
                  <span>Walkthrough</span>
                </div>
              </CardTitle>
              <CardDescription>
                Test how easily users can navigate your product. Discover and
                fix obstacles that might prevent them from completing essential
                tasks.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/heuristic/new">
          <Card className="h-full w-full hover:border-black">
            <CardHeader>
              <CardTitle>Evaluation</CardTitle>
              <CardDescription>
                Evaluate your interface against design best practices. Discover
                what works well and what could be improved for a better user
                experience.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
