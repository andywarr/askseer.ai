// Next imports
import Image from "next/image";

// Prisma imports
import { SourceType } from "@prisma/client";

// Ui component imports
import { AspectRatio } from "@/components/ui/aspect-ratio";

export function CognitiveWalkthroughDetails(props: {
  step: number;
  totalSteps: number;
  detail: any;
  // detail: {
  //   id: string;
  //   stepId: string;
  //   question1: string | null;
  //   question2: string | null;
  //   question3: string | null;
  //   question4: string | null;
  //   hasDiscoverabilityIssue: boolean | null;
  //   discoverabilityIssue: string | null;
  //   discoverabilityRecommendation: string | null;
  //   hasLearnabilityIssue: boolean | null;
  //   learnabilityIssue: string | null;
  //   learnabilityRecommendation: string | null;
  //   hasUsabilityIssue: boolean | null;
  //   usabilityIssue: string | null;
  //   usabilityRecommendation: string | null;
  //   source: SourceType;
  // };
  imageUrl: string;
}) {
  console.info(props.detail);

  return (
    <div className="mb-4 flex w-full flex-col gap-2">
      <div className="font-semibold leading-7 tracking-tight">
        Step {props.step}
      </div>
      <div className="flex flex-row gap-4">
        <div className="w-[200px]">
          <AspectRatio ratio={1 / 1}>
            <Image
              src={props.imageUrl}
              alt={`Step ${props.step} in the user flow`}
              width={200} // Placeholder width
              height={200} // Placeholder height
              className="rounded-md object-cover p-1 shadow"
            />
          </AspectRatio>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            {props.step > 1 && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  Is the user interface at this step what was expected?
                </p>
                <p className="leading-7">
                  {props.detail.question1 ? "Yes" : "No"}
                </p>
              </div>
            )}
          </div>
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  What is the next task the user needs to take at this step to
                  achieve their goal?
                </p>
                <p className="leading-7">{props.detail.question2}</p>
              </div>
            )}
          </div>
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  How will the user achieve this task at this step?
                </p>
                <p className="leading-7">{props.detail.question3}</p>
              </div>
            )}
          </div>
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="leading-7 tracking-tight text-zinc-500">
                  What will the user expect to happen next after completing this
                  task?
                </p>
                <p className="leading-7">{props.detail.question4}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
