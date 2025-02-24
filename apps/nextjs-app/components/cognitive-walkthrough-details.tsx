// Next imports
import Image from "next/image";

// Ui component imports
import { AspectRatio } from "@/apps/nextjs-app/components/ui/aspect-ratio";

export function CognitiveWalkthroughDetails(props: {
  step: number;
  totalSteps: number;
  expected: boolean;
  results: any;
  imageUrl: string;
}) {
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
          {props.step > 1 && (
            <div>
              <p className="text-sm leading-7 tracking-tight text-zinc-500">
                Is the user interface at this step what was expected?
              </p>
              <p className="leading-7">{props.expected ? "Yes" : "No"}</p>
            </div>
          )}
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  {props.results[0].question.question}
                </p>
                <p className="leading-7">{props.results[0].answer}</p>
              </div>
            )}
          </div>
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  {props.results[1].question.question}
                </p>
                <p className="leading-7">{props.results[1].answer}</p>
              </div>
            )}
          </div>
          <div>
            {props.step < props.totalSteps && (
              <div>
                <p className="text-sm leading-7 tracking-tight text-zinc-500">
                  {props.results[2].question.question}
                </p>
                <p className="leading-7">{props.results[2].answer}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
