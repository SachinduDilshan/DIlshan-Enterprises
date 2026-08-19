"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  icon?: React.ElementType;
  iconBg?: string;
  iconColor?: string;
  confirmClassName?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  icon: Icon = LogOut,
  iconBg = "bg-brand-50",
  iconColor = "text-brand-600",
  confirmClassName = "",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);

    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={title} onClose={onCancel} size="sm">

      {/* Icon */}

      <div className="mb-1 flex items-center gap-3">

        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>

      </div>


      {/* Description */}

      <p className="text-sm leading-5 text-gray-600">
        {description}
      </p>


      {/* Actions */}

      <div className="flex gap-3 pt-1">

        <Button
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </Button>


        <Button
          className={`flex-1 ${confirmClassName}`}
          loading={loading}
          onClick={handleConfirm}
          type="button"
        >
          {confirmLabel}
        </Button>

      </div>

    </Modal>
  );
}