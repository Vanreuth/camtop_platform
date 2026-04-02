"use client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
  warningMessage?: string;
}

export function DeleteDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
  isLoading,
  warningMessage,
}: DeleteDialogProps) {
  const handleConfirm = async () => {
    try {
      await onConfirm();
      toast.success(`${itemName} has been deleted successfully`);
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to delete ${itemName}. Please try again.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <DialogTitle>Delete Confirmation</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            Are you absolutely sure you want to delete{" "}
            <strong>{itemName}</strong>?
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {warningMessage ||
              "This action cannot be undone. This will permanently delete the item from the database."}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
