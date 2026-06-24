import { cn } from '@agile-ish/ui';
import { cloneElement, type ReactElement, type ReactNode } from 'react';

import { Label } from './label.js';

/**
 * Lightweight form-field composer.
 *
 * Pairs a label + input + optional helper/error text, threading `aria-*`
 * attributes for accessibility. Wraps any input-shaped child (Input,
 * Textarea, Select…) — we clone the element to inject ids and aria props
 * instead of forcing every input variant to know about field state.
 */
interface FormFieldProps {
  id: string;
  label: string;
  // Explicit `| undefined` so callers can pass `error={errors.x?.message}`
  // directly (which is `string | undefined`) under exactOptionalPropertyTypes.
  helperText?: string | undefined;
  error?: string | undefined;
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
  className?: string | undefined;
}

export const FormField = ({
  id,
  label,
  helperText,
  error,
  children,
  className,
}: FormFieldProps) => {
  const describedBy: string[] = [];
  if (error) describedBy.push(`${id}-error`);
  else if (helperText) describedBy.push(`${id}-helper`);

  // Build props conditionally — `exactOptionalPropertyTypes` rejects passing
  // `undefined` explicitly to optional props; we omit the key instead.
  const childProps: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string } = { id };
  if (error) childProps['aria-invalid'] = true;
  if (describedBy.length) childProps['aria-describedby'] = describedBy.join(' ');
  const cloned = cloneElement(children, childProps);

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {cloned}
      {error ? (
        <FieldMessage id={`${id}-error`} tone="error">
          {error}
        </FieldMessage>
      ) : helperText ? (
        <FieldMessage id={`${id}-helper`} tone="muted">
          {helperText}
        </FieldMessage>
      ) : null}
    </div>
  );
};

const FieldMessage = ({
  id,
  tone,
  children,
}: {
  id: string;
  tone: 'error' | 'muted';
  children: ReactNode;
}) => (
  <p
    id={id}
    className={cn('text-xs', tone === 'error' ? 'text-destructive' : 'text-muted-foreground')}
  >
    {children}
  </p>
);
