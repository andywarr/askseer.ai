'use client'

import {
  Button, Input, Radio, Typography
} from "@/MTailwind";
import { Evaluate } from "@/app/components/evaluate-button";
import { heuristicEvaluationFormAction } from "@/app/lib/action";
import { useRef, useState } from 'react';

interface PropData {
  credits: number;
}

interface User {
    id: string;
    name: string | null;
    email: string;
    emailVerified: Date | null;
    image: string | null;
    credits: number;
    createdAt: Date;
    updatedAt: Date;
  }
 
export function HeuristicEvaluationForm(props:  {user: User} ) {
  const heuristicEvaluationFormActionWithId = heuristicEvaluationFormAction.bind(null, props.user);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(0);

  const handleButtonClick = () => {
    if (!fileInputRef.current) return;

    fileInputRef.current.click();
  };

  const handleFileInputChange = (e : any) => {
    setFiles(e.target.files.length);
  };

  return (
    <form action={heuristicEvaluationFormActionWithId} autoComplete="off">
      <Input
        label="Goal"
        name="goal"
        placeholder="What is the user goal?"
        size="lg"
        variant="standard"
        crossOrigin={undefined} />
      
      <div className="flex">
      <input
        accept="images/*"
        className="hidden"
        multiple={true} 
        name="file"
        onChange={handleFileInputChange}
        ref={fileInputRef}
        type="file" />

        <Button 
          className="flex items-center gap-3 mt-6 mb-6"
          onClick={handleButtonClick}
          variant="gradient">
          <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-5 w-5"
          >
              <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
          </svg>
          Upload Flow
        </Button>

        <p className="flex flex-wrap content-end ml-3 gap-3 mt-4 mb-6"><span className="antialiased block font-light text-xs">{files} {files !== 1 ? ' files ' : ' file '} selected.</span></p>
      </div>

      <Typography
        color="blue-gray">
        Which set of heuristics would you like to evaluate the flow?
      </Typography>

      <Radio 
        defaultChecked
        label="Nielsen"
        name="heuristic"
        value="nielsen" crossOrigin={undefined} />

      <Radio 
        label="Tenents & Traps"
        name="heuristic"
        value="tenets" crossOrigin={undefined}  />
      
      <div className="flex">
        <Evaluate credits={props.user.credits} />
        <p className="flex flex-wrap content-end ml-3"><span className="antialiased block font-light text-xs">{props.user.credits} {props.user.credits !== 1 ? 'tries' : 'try'} remaining.</span></p>
      </div>
    </form>
  )
}