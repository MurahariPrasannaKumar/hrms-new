import * as React from "react";
import { NativeSelect as BaseSelect } from "@/components/ui/native-select";

export interface Option { value: string; label: string }

type Props = React.ComponentProps<"select"> & {
  /** Convenience: render options from data. Children still work for hand-written <option>s. */
  options?: Option[];
  placeholder?: string;
};

/** Accessible native select. Accepts either `options` or <option> children; forwards refs (RHF register). */
export function NativeSelect({ options, placeholder, children, ...rest }: Props) {
  return (
    <BaseSelect {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options?.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {children}
    </BaseSelect>
  );
}
