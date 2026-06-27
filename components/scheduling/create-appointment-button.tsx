"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateAppointmentModal, type SchedulingOptions } from "@/components/scheduling/create-appointment-modal";

export function CreateAppointmentButton({
  options,
  label = "New appointment",
  variant = "primary",
}: {
  options: SchedulingOptions;
  label?: string;
  variant?: "primary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={2.2} aria-hidden />
        {label}
      </Button>
      <CreateAppointmentModal open={open} onClose={() => setOpen(false)} options={options} />
    </>
  );
}
