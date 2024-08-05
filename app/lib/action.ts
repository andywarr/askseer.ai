// @ts-nocheck
'use server';

import { newHeuristicEvaluation } from "@/app/lib/data";
import OpenAI from "openai";
import { redirect } from 'next/navigation'

interface FileData {
  name: string;
  data: string;
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

const openai = new OpenAI();

const nielsen = `The design should always keep users informed about what is going on, through appropriate feedback within a reasonable amount of time;
                 The design should speak the users' language. Use words, phrases, and concepts familiar to the user, rather than internal jargon. Follow real-world conventions, making information appear in a natural and logical order;
                 Users often perform actions by mistake. They need a clearly marked "emergency exit" to leave the unwanted action without having to go through an extended process;
                 Users should not have to wonder whether different words, situations, or actions mean the same thing. Follow platform and industry conventions;
                 Good error messages are important, but the best designs carefully prevent problems from occurring in the first place. Either eliminate error-prone conditions, or check for them and present users with a confirmation option before they commit to the action;
                 Minimize the user's memory load by making elements, actions, and options visible. The user should not have to remember information from one part of the interface to another. Information required to use the design (e.g. field labels or menu items) should be visible or easily retrievable when needed;
                 Shortcuts — hidden from novice users — may speed up the interaction for the expert user so that the design can cater to both inexperienced and experienced users. Allow users to tailor frequent actions;
                 Interfaces should not contain information that is irrelevant or rarely needed. Every extra unit of information in an interface competes with the relevant units of information and diminishes their relative visibility;
                 Error messages should be expressed in plain language (no error codes), precisely indicate the problem, and constructively suggest a solution;
                 It’s best if the system doesn’t need any additional explanation. However, it may be necessary to provide documentation to help users understand how to complete their tasks.`;

const tenets = `A provided cue is not noticed, or is slow to be noticed, because its appearance or location differs from what the user expects;
                No cue is provided to signal to the user how to achieve a goal, and the user has insufficient prior learning to overcome its absence;
                Something in the UI suddenly appears or others draws the user's attention, distracting them from their goal;
                A cue critical to achieving a goal is noticed, but is meaning, or the required method or interacting with it, is unclear;
                A cue is incorrectly judged as a means for achieving a goal. It looks right, but is wrong;
                A critical relationship between two or more otherwise notiable cues is not obvious;
                The system does not allow the user to issue a command or complete a sequence of actions in the order or manner that is most nature to them;
                The system requires the user to remember information that us easy to forget;
                The system fails to provide noticeable, comprehensive, and actionable feedback in response to user actions;
                An action the system requires the user to perform is physically effortful, difficult, or impossible;
                The system misinterprets a user's physical actions resulting in an unintended outcome;
                The user is prevented from achieving a goal in a timely manner because of actual or perceived poor system performance;
                The user is prevented from achieving a goal in a timely manner because the system intentionally prevents them from advancing and/or backing out of a process;
                When the product is being used as intended, the number of actual or perceived steps required to achieve a goal is too high;
                The system re-prompts the user for information it previously gathered, or otherwise fails to leverage the user's prior work;
                Information presented to the user is comprehensible, but there is too much of it;
                The system incorrectly predicts or interprets the user's intent or preference, resulting in the user having to work around the problem;
                The system does not allow the user to undo an action they have taken;
                The system makes the user's data or behavior public in a way that is harmful or embarassing to the user;
                The system can lose the user's work through some action or inaction on the user's part;
                The system presents duplicate cues for the same action on the same level, or directly nested level of the UI;
                The system responds differently at different times to the same user action;
                The physical location of a cue for a given action varies across the UI;
                The visual appearance of a cue for a given action varies across the UI;
                The UI provides no single place the user can return to at any time to begin a new task or get re-iriented;
                The UI is aesthetically pleasing, inconsistent, and/or inappropriate for its intended users.`

export async function heuristicEvaluation(goal: string, files: Array<FileData>, heuristic: string) {
  let content = [];

  content.push({
    type: "text",
    text: `The user goal is: ${goal}. Which of the following heuristics are violated: ${heuristic === 'nielsen' ? nielsen : tenets} Format the output as a json object with an array of objects named 'Results' that includes 3 properties: 1. heuristic, which is the text of heuristic being evaluated; 2. violated, which is a value with yes or no indicating whether the heuristic has been violated or not; 3. reason, which is the reason the heuristic has been violated or not.`
  });

  files.forEach((file) => {
    content.push({
      type: "image_url",
      image_url: {
        "url": `data:image/png;base64, ${file.data}`
      }
    });
  });

  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: content,
      }
    ],
    stream: false,
    response_format: { "type": "json_object" },
    max_tokens: 2000
  };

  const response = await openai.chat.completions.create(params);

  return response;
}

export async function heuristicEvaluationFormAction(user: User, data: FormData) {
  const goal: string | null = data.get("goal") as string;
  const files: Array<File> | null = data.getAll("file") as Array<File>;
  const heuristic: string | null = data.get("heuristic") as string;

  if (user?.id && goal && files && heuristic) {
    const base64_files = await Promise.all(files.map(async (file) => {
      const bytes = await file.arrayBuffer();
      const data = Buffer.from(bytes).toString('base64');
      return {
        name: file.name,
        data: data,
      };
    }));

    const response = await heuristicEvaluation(goal, base64_files, heuristic);

    // If user does not exist there is a problem
    if (response.choices[0].message.content == null) {
      return {
        redirect: {
          destination: '/error',
          permanent: false,
        },
      };
    }

    const response_content = JSON.parse(response.choices[0].message.content);

    // Add the results to the database
    const heuristicEvaluationResults = await newHeuristicEvaluation(user.id, goal, base64_files, heuristic, response_content.Results);

    redirect(`/heuristic/${heuristicEvaluationResults.id}`);
  }
}
