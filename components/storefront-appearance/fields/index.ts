/**
 * The field primitives for the Storefront Appearance tab (#102).
 *
 * Every editor in the tab currently hand-rolls its own inputs, and the four
 * defects that produces — no client-side length guard on 40+ limited columns,
 * a clamp copied four times and got wrong a fifth, an empty-value policy
 * chosen ad hoc at eleven call sites, and six toggle rows in three styles —
 * are all defects of construction rather than of care. These components make
 * each of them impossible to write rather than merely wrong.
 *
 * shadcn/ui underneath, scoped to this tab per the owner's call (2026-09-21).
 * No `.dash-*` classes: the two systems coexist deliberately until #102
 * decides whether shadcn spreads further.
 */

export { FieldRow, useFieldIds, describedBy } from './FieldRow';
export type { FieldRowProps, FieldIds } from './FieldRow';

export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';

export { TextAreaField } from './TextAreaField';
export type { TextAreaFieldProps } from './TextAreaField';

export { NumberField, clampNumber } from './NumberField';
export type { NumberFieldProps } from './NumberField';

export { SelectField } from './SelectField';
export type { SelectFieldProps, SelectOption } from './SelectField';

export { ToggleRow } from './ToggleRow';
export type { ToggleRowProps } from './ToggleRow';

export { ColorField, classifyFreeColor } from './ColorField';
export type {
  ColorFieldProps,
  HexColorFieldProps,
  FreeColorFieldProps,
  FreeColorShape,
} from './ColorField';

export { applyTextPolicy, counterThresholdFor, lengthState } from './text-policy';
export type { EmptyPolicy, EmptyValue, LengthState } from './text-policy';
