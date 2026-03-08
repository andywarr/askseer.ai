import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, differenceInSeconds } from "date-fns";

import { getCurrentUser } from "@/apps/nextjs-app/lib/db/user";
import { getLiveSessionDetailsDb } from "@/apps/nextjs-app/lib/db/data";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/apps/nextjs-app/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/apps/nextjs-app/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/apps/nextjs-app/components/ui/tabs";
import { Badge } from "@/apps/nextjs-app/components/ui/badge";
import { SessionTimeline } from "@/apps/nextjs-app/components/live-session/session-timeline";
import { TranscriptViewer } from "@/apps/nextjs-app/components/live-session/transcript-viewer";
import {
  Video,
  FileText,
  Clock,
  Bug,
  Lightbulb,
  AlertTriangle,
  Zap,
  MessageSquare,
  StickyNote,
} from "lucide-react";

const STATUS_BADGES: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  SCHEDULED: { label: "Scheduled", variant: "outline" },
  LIVE: { label: "Live", variant: "destructive" },
  ENDED: { label: "Ended", variant: "secondary" },
  PROCESSING: { label: "Processing", variant: "default" },
  COMPLETED: { label: "Completed", variant: "default" },
};

export default async function PostSessionOutputPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const { user } = await getCurrentUser();
  const session = await getLiveSessionDetailsDb(sessionId);

  if (!session || session.study?.id !== id) {
    return notFound();
  }

  const study = session.study;
  const tags = session.tags || [];
  const notes = session.notes || [];
  const chatMessages = session.backroomMessages || [];
  const duration =
    session.startedAt && session.endedAt
      ? differenceInSeconds(
          new Date(session.endedAt),
          new Date(session.startedAt),
        )
      : 0;

  // Tag counts for summary
  const tagCounts = tags.reduce(
    (acc: Record<string, number>, t: any) => {
      acc[t.tagType] = (acc[t.tagType] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const statusBadge = STATUS_BADGES[session.status] || STATUS_BADGES.SCHEDULED;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/studies">Studies</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/live/${id}`}>
              {study?.name || "Live Session"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{session.name || "Session Output"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {session.name || "Session Output"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {session.startedAt
              ? `Started ${formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}`
              : `Created ${formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}`}
            {duration > 0 && ` · ${Math.round(duration / 60)} min`}
          </p>
        </div>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <Bug className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tagCounts.BUG || 0}</p>
              <p className="text-muted-foreground text-xs">Bugs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tagCounts.PAIN_POINT || 0}</p>
              <p className="text-muted-foreground text-xs">Pain Points</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Lightbulb className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tagCounts.IDEA || 0}</p>
              <p className="text-muted-foreground text-xs">Ideas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tagCounts.INSIGHT || 0}</p>
              <p className="text-muted-foreground text-xs">Insights</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <StickyNote className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notes.length}</p>
              <p className="text-muted-foreground text-xs">Notes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="transcript" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Transcript
          </TabsTrigger>
          <TabsTrigger value="recording" className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5" />
            Recording
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Backroom Chat ({chatMessages.length})
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card>
            <CardHeader>
              <CardTitle>Session Timeline</CardTitle>
              <CardDescription>
                All tags and notes anchored to the session timeline. Click any
                item to jump to that moment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SessionTimeline tags={tags} notes={notes} duration={duration} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transcript Tab */}
        <TabsContent value="transcript">
          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
              <CardDescription>
                Speaker-labeled transcript synced to the recording timeline.
                Search for specific topics.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TranscriptViewer transcriptText={session.transcriptText || ""} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recording Tab */}
        <TabsContent value="recording">
          <Card>
            <CardHeader>
              <CardTitle>Recording</CardTitle>
              <CardDescription>
                Cloud recording of the session with synced audio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {session.recordingUrl ? (
                <div className="aspect-video overflow-hidden rounded-lg bg-black">
                  <video
                    src={session.recordingUrl}
                    controls
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <div className="text-muted-foreground flex h-40 items-center justify-center text-sm">
                  {session.status === "PROCESSING"
                    ? "Recording is being processed. Check back shortly."
                    : session.status === "ENDED"
                      ? "Recording will be available once processing completes."
                      : "No recording available for this session."}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Backroom Chat Tab */}
        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Backroom Chat Log</CardTitle>
              <CardDescription>
                Internal team conversation from during the session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chatMessages.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No backroom messages were sent during this session.
                </p>
              ) : (
                <div className="space-y-3">
                  {chatMessages.map((msg: any) => (
                    <div
                      key={msg.id}
                      className="flex gap-3 rounded-lg border p-3"
                    >
                      <div className="flex-1">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm font-medium">
                            {msg.user?.name || "Anonymous"}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {Math.floor(msg.timestamp / 60)}:
                            {Math.floor(msg.timestamp % 60)
                              .toString()
                              .padStart(2, "0")}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {msg.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Research Context (from Analysis Guide) */}
      {(study?.jobData?.researchQuestions?.length > 0 ||
        study?.jobData?.hypotheses?.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Research Context Alignment</CardTitle>
            <CardDescription>
              How session findings map to your original research questions and
              hypotheses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {study.jobData.researchQuestions?.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold">
                  Research Questions
                </h4>
                <div className="space-y-3">
                  {study.jobData.researchQuestions.map(
                    (q: string, i: number) => {
                      // Find notes/tags that might relate (simple keyword overlap)
                      const relatedNotes = notes.filter((n: any) =>
                        q
                          .split(" ")
                          .some(
                            (word: string) =>
                              word.length > 3 &&
                              n.text.toLowerCase().includes(word.toLowerCase()),
                          ),
                      );
                      return (
                        <div key={i} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">{q}</p>
                          {relatedNotes.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <span className="text-muted-foreground text-xs">
                                {relatedNotes.length} potentially related note
                                {relatedNotes.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}

            {study.jobData.hypotheses?.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold">Hypotheses</h4>
                <div className="space-y-3">
                  {study.jobData.hypotheses.map((h: string, i: number) => (
                    <div key={i} className="rounded-lg border p-3">
                      <p className="text-sm">{h}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
