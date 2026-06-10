"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Trash2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  title:       string;
  description: string;
  onConfirm:   () => Promise<void>;
  onCancel:    () => void;
}

export function DeleteConfirmDialog({
  title,
  description,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 flex-shrink-0">
            <Trash2 className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-medium text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500">This cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4 rounded-xl bg-gray-50 px-3 py-2.5">
          {description}
        </p>

        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 mb-4 text-xs text-red-800">
          ⚠ Are you sure you want to permanently delete this record?
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            type="button"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={deleting}
            onClick={handleConfirm}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
