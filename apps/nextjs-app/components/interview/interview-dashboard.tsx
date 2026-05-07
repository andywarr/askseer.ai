"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createInterviewSession,
  getInterviewData,
} from "@/apps/nextjs-app/lib/actions/interview-actions";
import {
  Copy,
  Plus,
  ExternalLink,
  Loader2,
  Mic,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/apps/nextjs-app/components/ui/button";

interface InterviewDashboardProps {
  studyId: string;
  initialData: any;
}

export function InterviewDashboard({
  studyId,
  initialData,
}: InterviewDashboardProps) {
  const [data, setData] = useState(initialData);
  const [creatingSession, setCreatingSession] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const questions = data?.questions || [];
  const sessions = data?.sessions || [];
  const systemPrompt = data?.systemPrompt || "";

  const refreshData = async () => {
    const result = await getInterviewData(studyId);
    if (result.success) {
      setData(result.data);
    }
  };

  const handleCreateSession = async () => {
    if (!data?.id) {
      toast.error(
        "Interview not ready yet. Please wait for processing to complete.",
      );
      return;
    }

    setCreatingSession(true);
    try {
      const result = await createInterviewSession(data.id);
      if (result.success) {
        toast.success("Session created! Copy the links below.");
        await refreshData();
      } else {
        toast.error(result.error || "Failed to create session");
      }
    } catch (error) {
      toast.error("Failed to create session");
    } finally {
      setCreatingSession(false);
    }
  };

  const copyLink = async (link: string, label: string) => {
    const url = `${window.location.origin}/session/interview/${link}`;
    await navigator.clipboard.writeText(url);
    setCopiedLink(link);
    toast.success(`${label} link copied!`);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SCHEDULED: "bg-zinc-800 text-zinc-300",
      LIVE: "bg-green-900/50 text-green-400 animate-pulse",
      COMPLETED: "bg-blue-900/50 text-blue-400",
      INCOMPLETE: "bg-amber-900/50 text-amber-400",
    };
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.SCHEDULED}`}
      >
        {status === "LIVE" && (
          <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
        )}
        {status === "COMPLETED" && <CheckCircle2 className="h-3 w-3" />}
        {status === "INCOMPLETE" && <XCircle className="h-3 w-3" />}
        {status === "SCHEDULED" && <Clock className="h-3 w-3" />}
        {status}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Interview</h1>
        <p className="text-muted-foreground mt-1">
          Manage sessions, view transcripts, and run analysis.
        </p>
      </div>

      {/* Questions / Tasks */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Discussion Guide ({questions.length} items)
        </h2>
        {questions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <Loader2 className="text-muted-foreground mx-auto mb-2 h-5 w-5 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Processing discussion guide...
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {questions.map((q: any, i: number) => (
              <div
                key={q.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm">{q.text}</p>
                  <span className="text-muted-foreground text-xs uppercase">
                    {q.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* System Prompt Preview */}
      {systemPrompt && (
        <section>
          <details className="group">
            <summary className="cursor-pointer text-lg font-semibold">
              AI Moderator Prompt
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                (click to expand)
              </span>
            </summary>
            <div className="mt-2 rounded-lg border bg-zinc-900/50 p-4">
              <pre className="text-xs whitespace-pre-wrap text-zinc-300">
                {systemPrompt}
              </pre>
            </div>
          </details>
        </section>
      )}

      {/* Sessions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Sessions ({sessions.length})
          </h2>
          <Button
            size="sm"
            onClick={handleCreateSession}
            disabled={creatingSession || !data?.id}
          >
            {creatingSession ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            New Session
          </Button>
        </div>

        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions yet. Create one to generate participant and observer
              links.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session: any) => (
              <div key={session.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusBadge(session.status)}
                    <span className="text-muted-foreground text-xs">
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                    {session._count?.messages > 0 && (
                      <span className="text-muted-foreground text-xs">
                        {session._count.messages} messages
                      </span>
                    )}
                  </div>
                </div>

                {/* Session Links */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyLink(session.participantLink, "Participant")
                    }
                    className="gap-2"
                  >
                    {copiedLink === session.participantLink ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Mic className="h-3.5 w-3.5" />
                    )}
                    Participant Link
                    <Copy className="h-3 w-3 opacity-50" />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyLink(session.observerLink, "Observer")}
                    className="gap-2"
                  >
                    {copiedLink === session.observerLink ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Observer Link
                    <Copy className="h-3 w-3 opacity-50" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
