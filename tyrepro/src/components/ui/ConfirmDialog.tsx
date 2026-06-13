"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { LogOut } from "lucide-react";

interface ConfirmDialogProps {
  title:       string;
  description: string;
  confirmLabel?: string;
  icon?:       React.ElementType;
  iconBg?:     string;
  iconColor?:  string;
  onConfirm:   () => Promise<void> | void;
  onCancel:    () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = "Confirm",
  icon: Icon = LogOut,
  iconBg = "bg-brand-50",
  iconColor = "text-brand-600",
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg} flex-shrink-0`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <h3 className="text-base font-medium text-gray-900">{title}</h3>
        </div>

        <p className="text-sm text-gray-600 mb-5">{description}</p>

        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} type="button">
            Cancel
          </Button>
          <Button className="flex-1" loading={loading} onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}