'use client'

import {
  Button
} from "@/MTailwind";
import { Loading } from "@/app/components/loading";
import { useFormStatus } from 'react-dom'

export function Evaluate(props: { credits: number }) {
  const { pending } = useFormStatus();

  return (
    <div>
      <Button
        disabled={props.credits > 0 && !pending ? false : true}
        variant="gradient"
        size="md"
        className="w-32"
        type="submit"
      >Evaluate</Button>
      {pending && <Loading />}
    </div>
  )
}
