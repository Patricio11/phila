import * as React from "react";
import { Slot } from "@/components/ui/slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Button  DESIGN.md §6. `primary` (accent fill), `ghost` (surface + border),
 * and the small in-row `mini` / `mini-solid`. Buttons depress 1px on press;
 * primary is ≥ 44px tall (WCAG 2.2 AA target size). Status never relies on
 * colour alone, so loading shows a spinner and disabled is visibly muted.
 */
const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium outline-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-ink shadow-sm hover:bg-accent-hover [--spinner:var(--color-accent-ink)]",
        ghost:
          "border border-border bg-surface text-text hover:bg-surface-hover hover:border-border-strong [--spinner:var(--color-text)]",
        subtle:
          "bg-surface-2 text-text-2 hover:bg-surface-hover hover:text-text [--spinner:var(--color-text)]",
        danger:
          "bg-danger text-white shadow-sm hover:brightness-95 [--spinner:white]",
        link: "text-accent underline-offset-4 hover:underline [--spinner:var(--color-accent)]",
        mini: "h-8 border border-border bg-surface px-2.5 text-[13px] text-text-2 hover:bg-surface-hover hover:text-text [--spinner:var(--color-text)]",
        "mini-solid":
          "h-8 bg-accent px-2.5 text-[13px] text-accent-ink hover:bg-accent-hover [--spinner:var(--color-accent-ink)]",
      },
      size: {
        sm: "h-9 px-3 text-[13px]",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-[15px]",
        icon: "size-9 p-0",
      },
    },
    compoundVariants: [
      { variant: "mini", size: ["sm", "md", "lg"], class: "h-8 px-2.5" },
      { variant: "mini-solid", size: ["sm", "md", "lg"], class: "h-8 px-2.5" },
    ],
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className, variant, size, asChild, loading, disabled, children, ...props },
    ref,
  ) {
    // With `asChild` the Slot must receive exactly one child, so the spinner is
    // only composed for a real <button>. (asChild is for links, not loading.)
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(buttonVariants({ variant, size }), className)}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled ?? loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin [color:var(--spinner)]" aria-hidden />
        ) : null}
        {children}
      </button>
    );
  },
);

export { buttonVariants };
