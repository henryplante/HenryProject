import { Check } from "lucide-react";
import type { CycleView } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { buildStepperModel } from "./model";

export function ReviewStepper({ cycle }: { cycle: CycleView | undefined }) {
  const model = buildStepperModel(cycle);

  if (model.kind === "empty") {
    return (
      <div
        data-slot="review-stepper"
        data-empty="true"
        className="border-b px-6 py-3 text-sm text-muted-foreground"
      >
        No review started
      </div>
    );
  }

  return (
    <nav
      aria-label="Review progress"
      data-slot="review-stepper"
      className="overflow-x-auto border-b px-6 py-4"
    >
      <ol className="flex min-w-max items-start gap-3">
        {model.steps.map((step, index) => {
          const active = step.state === "active";
          const done = step.state === "completed";
          return (
            <li
              key={step.position}
              data-state={step.state}
              aria-current={active ? "step" : undefined}
              className="flex items-start gap-3"
            >
              <div className="flex min-w-32 flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium",
                      done && "border-emerald-600 bg-emerald-600 text-white",
                      active && "border-primary bg-primary text-primary-foreground",
                      !done && !active && "text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-3" aria-hidden /> : step.position}
                  </span>
                  <span
                    className={cn(
                      "text-sm",
                      active ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
                <ul
                  className={cn(
                    "flex flex-col gap-0.5 pl-7",
                    active ? "text-sm" : "text-xs text-muted-foreground",
                  )}
                >
                  {step.requirements.map((r) => (
                    <li
                      key={r.groupId}
                      data-met={r.met}
                      className={cn(
                        active && !r.met && "font-medium text-foreground",
                        active && r.met && "text-emerald-700",
                      )}
                    >
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              {index < model.steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mt-2.5 h-px w-8 shrink-0",
                    done ? "bg-emerald-600" : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
