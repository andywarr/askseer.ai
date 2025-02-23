// Next imports
import Link from "next/link";

// Lib functions imports
import { isAuthenticated } from "@/lib/dal";

// Lib functions imports
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

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
              <CardTitle>Cognitive Walkthrough</CardTitle>
              <CardDescription>
                A usability inspection method used to identify usability issues
                in interactive systems, focusing on how easy it is for new users
                to accomplish tasks with the system.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/heuristic/new">
          <Card className="h-full w-full hover:border-black">
            <CardHeader>
              <CardTitle>Heuristic Evaluation</CardTitle>
              <CardDescription>
                A usability inspection method for an interactive system that
                helps to identify usability problems in the user interface
                design.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
