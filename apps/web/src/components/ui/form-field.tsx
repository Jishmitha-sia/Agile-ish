import { cloneElement, type ReactElement, type ReactNode } from 'react';

import { cn } from '@agile-ish/ui';

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
  helperText?: string;
  error?: string;
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
  className?: string;
}

export const FormField = ({ id, label, helperText, error, children, className }: FormFieldProps) => {
  const describedBy: string[] = [];
  if (error) describedBy.push(`${id}-error`);
  else if (helperText) describedBy.push(`${id}-helper`);

  const cloned = cloneElement(children, {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy.length ? describedBy.join(' ') : undefined,
  });

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
    className={cn(
      'text-xs',
      tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
    )}
  >
    {children}
  </p>
);
