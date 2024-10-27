"use client";

import { Loading } from "@/app/components/loading";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function Evaluate(props: { credits: number }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button
        disabled={props.credits > 0 && !pending ? false : true}
        className="w-32"
        type="submit"
      >
        Evaluate
      </Button>
      {pending && <Loading />}
    </div>
  );
}
