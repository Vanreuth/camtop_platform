"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, CheckCircle, XCircle, Archive, RotateCcw } from "lucide-react";
import {
  useSubmitPropertyForReview,
  useApproveProperty,
  useRejectProperty,
  useArchiveProperty,
  useRestoreProperty,
} from "@/hooks/property/useProperty";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  approvePropertySchema,
  rejectPropertySchema,
} from "@/hooks/property/property.schema";

type PropertyWorkflowActionsProps = {
  propertyId: number;
  workflowStatus: string;
  propertyName: string;
  canSubmit?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canArchive?: boolean;
  canRestore?: boolean;
  onSuccess?: () => void;
};

type DialogType = "approve" | "reject" | null;

export function PropertyWorkflowActions({
  propertyId,
  workflowStatus,
  propertyName,
  canSubmit = false,
  canApprove = false,
  canReject = false,
  canArchive = false,
  canRestore = false,
  onSuccess,
}: PropertyWorkflowActionsProps) {
  const [dialogType, setDialogType] = useState<DialogType>(null);

  const submitMutation = useSubmitPropertyForReview();
  const approveMutation = useApproveProperty();
  const rejectMutation = useRejectProperty();
  const archiveMutation = useArchiveProperty();
  const restoreMutation = useRestoreProperty();

  // Approve form
  const approveForm = useForm<z.infer<typeof approvePropertySchema>>({
    resolver: zodResolver(approvePropertySchema),
    defaultValues: {
      notes: "",
    },
  });

  // Reject form
  const rejectForm = useForm<z.infer<typeof rejectPropertySchema>>({
    resolver: zodResolver(rejectPropertySchema),
    defaultValues: {
      reason: "",
    },
  });

  const handleSubmitForReview = async () => {
    await submitMutation.mutateAsync(propertyId);
    onSuccess?.();
  };

  const handleApprove = async (data: z.infer<typeof approvePropertySchema>) => {
    await approveMutation.mutateAsync({ id: propertyId, data });
    setDialogType(null);
    approveForm.reset();
    onSuccess?.();
  };

  const handleReject = async (data: z.infer<typeof rejectPropertySchema>) => {
    await rejectMutation.mutateAsync({ id: propertyId, data });
    setDialogType(null);
    rejectForm.reset();
    onSuccess?.();
  };

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(propertyId);
    onSuccess?.();
  };

  const handleRestore = async () => {
    await restoreMutation.mutateAsync(propertyId);
    onSuccess?.();
  };

  const showSubmitButton =
    canSubmit && (workflowStatus === "DRAFT" || workflowStatus === "REJECTED");
  const showApproveButton =
    canApprove && workflowStatus === "PENDING_REVIEW";
  const showRejectButton =
    canReject && workflowStatus === "PENDING_REVIEW";
  const showArchiveButton = canArchive && workflowStatus !== "ARCHIVED";
  const showRestoreButton = canRestore && workflowStatus === "ARCHIVED";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {showSubmitButton && (
          <Button
            onClick={handleSubmitForReview}
            disabled={submitMutation.isPending}
            size="sm"
            variant="outline"
          >
            <Send className="mr-2 h-4 w-4" />
            {submitMutation.isPending ? "Submitting..." : "Submit for Review"}
          </Button>
        )}

        {showApproveButton && (
          <Button
            onClick={() => setDialogType("approve")}
            disabled={approveMutation.isPending}
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Approve
          </Button>
        )}

        {showRejectButton && (
          <Button
            onClick={() => setDialogType("reject")}
            disabled={rejectMutation.isPending}
            size="sm"
            variant="destructive"
          >
            <XCircle className="mr-2 h-4 w-4" />
            Reject
          </Button>
        )}

        {showArchiveButton && (
          <Button
            onClick={handleArchive}
            disabled={archiveMutation.isPending}
            size="sm"
            variant="outline"
          >
            <Archive className="mr-2 h-4 w-4" />
            {archiveMutation.isPending ? "Archiving..." : "Archive"}
          </Button>
        )}

        {showRestoreButton && (
          <Button
            onClick={handleRestore}
            disabled={restoreMutation.isPending}
            size="sm"
            variant="outline"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            {restoreMutation.isPending ? "Restoring..." : "Restore"}
          </Button>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={dialogType === "approve"} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Property</DialogTitle>
            <DialogDescription>
              Add optional notes about this approval. This will be added to the property
              description.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={approveForm.handleSubmit(handleApprove)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="notes">Approval Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="E.g., All documentation verified and approved..."
                  {...approveForm.register("notes")}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogType(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? "Approving..." : "Approve Property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={dialogType === "reject"} onOpenChange={() => setDialogType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Property</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting this property. This will be sent to
              the property creator.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={rejectForm.handleSubmit(handleReject)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reason">Rejection Reason *</Label>
                <Textarea
                  id="reason"
                  placeholder="E.g., Missing title documents, incomplete information..."
                  {...rejectForm.register("reason")}
                  rows={4}
                  className={
                    rejectForm.formState.errors.reason ? "border-red-500" : ""
                  }
                />
                {rejectForm.formState.errors.reason && (
                  <p className="text-sm text-red-500">
                    {rejectForm.formState.errors.reason.message}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDialogType(null);
                  rejectForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={rejectMutation.isPending}
                variant="destructive"
              >
                {rejectMutation.isPending ? "Rejecting..." : "Reject Property"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
