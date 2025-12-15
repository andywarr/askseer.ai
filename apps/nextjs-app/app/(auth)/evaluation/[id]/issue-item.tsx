import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { HEResultData } from "@/apps/nextjs-app/types/types";
import { InfoCard } from "@/apps/nextjs-app/components/heuristics/info-card";
import { Separator } from "@/apps/nextjs-app/components/ui/separator";
import { Button } from "@/apps/nextjs-app/components/ui/button";
import { useIsMobile } from "@/apps/nextjs-app/hooks/use-mobile";
import { toast } from "sonner";
import { handleCreateRecommendation } from "@/apps/nextjs-app/lib/heuristic-actions";

interface IssueItemProps {
  item: HEResultData;
  heuristicKey: string;
  isFirstForStep: boolean;
  presignedUrls: string[];
  onDeleteIssue: (heuristicKey: string, issueId: string) => void;
  onDeleteRecommendation: (
    heuristicKey: string,
    issueId: string,
    recommendationId: string,
  ) => void;
  refreshResults: () => Promise<void>;
  canManage?: boolean;
}

export function IssueItem({
  item,
  heuristicKey,
  isFirstForStep,
  presignedUrls,
  onDeleteIssue,
  onDeleteRecommendation,
  refreshResults,
  canManage = true,
}: IssueItemProps) {
  const router = useRouter();
  const [editingRecommendationFor, setEditingRecommendationFor] = useState<
    string | null
  >(null);
  const [newRecommendation, setNewRecommendation] = useState("");
  const isMobile = useIsMobile();

  const handleSaveRecommendation = async (content: string) => {
    if (!canManage) return;
    setNewRecommendation("");
    setEditingRecommendationFor(null);
    if (!content.trim()) return;

    try {
      await handleCreateRecommendation(item.id, content, refreshResults);
      router.refresh(); // Refresh server component to update study metadata
      toast.success("Successfully added recommendation.");
    } catch (error) {
      toast.error("Failed to add recommendation. Please try again.");
    }
  };

  const handleDeleteIssueWithRefresh = async () => {
    if (!canManage) return;
    try {
      onDeleteIssue(heuristicKey, item.id);
      await refreshResults();
    } catch (error) {
      toast.error("Failed to delete issue. Please try again.");
    }
  };

  const handleDeleteRecommendationWithRefresh = async (
    recommendationId: string,
  ) => {
    if (!canManage) return;
    try {
      onDeleteRecommendation(heuristicKey, item.id, recommendationId);
      await refreshResults();
    } catch (error) {
      toast.error("Failed to delete recommendation. Please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`grid grid-cols-1 gap-4 ${
          isFirstForStep && typeof item.step === "number"
            ? "md:grid-cols-2"
            : ""
        }`}
      >
        {isFirstForStep && typeof item.step === "number" && (
          <div className="col-span-1">
            <Image
              src={presignedUrls[item.step - 1]}
              alt={`Step ${item.step} in the user flow`}
              width={500}
              height={500}
              priority={true}
              unoptimized={true}
              className="mx-auto h-auto max-h-96 w-full border object-contain p-1 shadow-sm md:mx-0"
            />
          </div>
        )}
        <div
          className={`col-span-1 mt-4 w-full min-w-0 space-y-4 md:mt-0${
            isFirstForStep && typeof item.step === "number"
              ? ""
              : "md:col-span-2"
          }`}
        >
          <InfoCard
            id={item.id}
            studyType="heuristicEvaluation"
            type="issue"
            content={item.reason}
            source={item.source}
            severity={item.severity}
            rating={
              item.rating === "UP" ? "up" : item.rating === "DOWN" ? "down" : null
            }
            onDelete={handleDeleteIssueWithRefresh}
            canManage={canManage}
          />
        </div>
      </div>
      <div className="mt-6">
        <div className="mb-2 pt-4 text-base font-semibold">Recommendations</div>
        <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-1">
          {item.recommendations.map((rec) => (
            <InfoCard
              key={rec.id}
              id={rec.id}
              studyType="heuristicEvaluation"
              type="recommendation"
              content={rec.recommendation}
              source={rec.source}
              rating={
                rec.rating === "UP" ? "up" : rec.rating === "DOWN" ? "down" : null
              }
              onDelete={() => handleDeleteRecommendationWithRefresh(rec.id)}
              canManage={canManage}
            />
          ))}
          {editingRecommendationFor === item.id ? (
            <InfoCard
              id={`new-${item.id}`}
              studyType="heuristicEvaluation"
              type="recommendation"
              content={newRecommendation}
              source="HUMAN"
              isEditing={true}
              onSave={handleSaveRecommendation}
              onCancel={() => {
                setEditingRecommendationFor(null);
                setNewRecommendation("");
              }}
              onEdit={async () => {
                try {
                  await refreshResults();
                } catch (error) {
                  toast.error(
                    "Failed to update recommendation. Please try again.",
                  );
                }
              }}
              canManage={canManage}
            />
          ) : (
            !isMobile &&
            canManage && (
              <div className="flex h-full items-end justify-start print:hidden">
                <Button
                  variant="link"
                  onClick={() => setEditingRecommendationFor(item.id)}
                >
                  Add recommendation
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
