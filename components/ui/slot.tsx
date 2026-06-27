import * as React from "react";

/**
 * Minimal `asChild` slot: renders its single child, merging the slot's props
 * (and ref) onto it. Lets primitives like Button compose with `<Link>` without
 * an extra wrapper element. A focused stand-in for @radix-ui/react-slot so we
 * don't add a dependency for one behaviour.
 */
export const Slot = React.forwardRef<HTMLElement, { children?: React.ReactNode } & Record<string, unknown>>(
  function Slot({ children, ...slotProps }, ref) {
    if (!React.isValidElement(children)) {
      if (React.Children.count(children) > 1) React.Children.only(null);
      return null;
    }

    const child = children as React.ReactElement<Record<string, unknown>>;
    const childProps = child.props;
    // React 19 passes ref as a normal prop; read it there, not via element.ref.
    const childRef = (childProps as { ref?: React.Ref<unknown> }).ref;

    const merged: Record<string, unknown> = { ...slotProps, ...childProps };

    // Merge className strings.
    if (slotProps.className || childProps.className) {
      merged.className = [slotProps.className, childProps.className]
        .filter(Boolean)
        .join(" ");
    }

    // Merge style objects.
    if (slotProps.style || childProps.style) {
      merged.style = {
        ...(slotProps.style as React.CSSProperties),
        ...(childProps.style as React.CSSProperties),
      };
    }

    // Compose event handlers (slot handler runs, then the child's).
    for (const key of Object.keys(slotProps)) {
      if (/^on[A-Z]/.test(key)) {
        const slotHandler = slotProps[key];
        const childHandler = childProps[key];
        if (typeof slotHandler === "function" || typeof childHandler === "function") {
          merged[key] = (...args: unknown[]) => {
            if (typeof childHandler === "function") childHandler(...args);
            if (typeof slotHandler === "function") slotHandler(...args);
          };
        }
      }
    }

    // Only attach a ref when one actually exists  creating a ref callback with
    // nothing to forward is rejected inside Server Components.
    const refs = [ref, childRef].filter(Boolean) as Array<React.Ref<unknown>>;
    if (refs.length > 0) merged.ref = refs.length === 1 ? refs[0] : mergeRefs(...refs);

    return React.cloneElement(child, merged);
  },
);

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return (node: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref && typeof ref === "object")
        (ref as React.RefObject<T | null>).current = node;
    }
  };
}
