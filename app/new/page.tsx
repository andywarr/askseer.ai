import Link from "next/link";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function CardWithForm() {
  return (
    <div>
      <h2 className="mb-4 inline-block h-full scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
        Unlock Insights
      </h2>
      <p className="mb-4">
        Select an AI-assisted research study that best suits your needs to
        unlock insights.
      </p>
      <div className="mb-4 flex flex-row gap-4">
        <Link href="/walkthrough/new">
          <Card className="h-[200px] w-[350px]">
            <CardHeader>
              <CardTitle>Cogntive Walkthrough</CardTitle>
              <CardDescription>
                A usability inspection method used to identify usability issues
                in interactive systems, focusing on how easy it is for new users
                to accomplish tasks with the system.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/heuristic/new">
          <Card className="h-[200px] w-[350px]">
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
