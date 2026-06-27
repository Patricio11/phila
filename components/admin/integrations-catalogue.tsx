"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import type { IntegrationCatalogItem } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Status = IntegrationCatalogItem["status"];
const STATUSES: Status[] = ["off", "mock", "live"];

const CATEGORY_LABEL: Record<IntegrationCatalogItem["category"], string> = {
  messaging: "Messaging",
  video: "Video",
  payments: "Payment providers",
  platform: "Platform",
};

const ORDER: IntegrationCatalogItem["category"][] = ["messaging", "video", "payments", "platform"];

export function IntegrationsCatalogue({ initial }: { initial: IntegrationCatalogItem[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(initial);

  const setStatus = (key: string, status: Status, name: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status } : i)));
    toast({ tone: "default", title: `${name} set to ${status}`, description: status === "off" ? "Hidden from orgs." : status === "mock" ? "Available in simulation." : "Live  orgs can connect it." });
  };

  return (
    <div className="space-y-7">
      {ORDER.map((cat) => {
        const catItems = items.filter((i) => i.category === cat);
        if (catItems.length === 0) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-text-3">{CATEGORY_LABEL[cat]}</h2>
            <div className="space-y-2.5">
              {catItems.map((item) => (
                <div key={item.key} className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-[600] text-text">{item.name}</div>
                    <p className="mt-0.5 text-[12.5px] text-text-2">{item.description}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => toast({ tone: "success", title: `${item.name} test passed` })}>
                    <Zap className="size-4" strokeWidth={2} aria-hidden /> Test
                  </Button>
                  <div className="inline-flex rounded-control border border-border p-0.5">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(item.key, s, item.name)}
                        className={cn("h-8 rounded-[6px] px-3 text-[12px] font-medium capitalize transition-colors", item.status === s ? statusCls(s) : "text-text-2 hover:text-text")}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function statusCls(s: Status): string {
  return s === "live" ? "bg-accent-soft text-accent" : s === "mock" ? "bg-warn-soft text-warn" : "bg-surface-2 text-text-3";
}
