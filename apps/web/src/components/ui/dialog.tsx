'use client';

import { cn } from '@agile-ish/ui';
import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type HTMLAttributes,
} from 'react';


export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogPortal = Primitive.Portal;
export const DialogClose = Primitive.Close;

export const DialogOverlay = forwardRef<
  ComponentRef<typeof Primitive.Overlay>,
  ComponentPropsWithoutRef<typeof Primitive.Overlay>
>(({ className, ...props }, ref) => (
  <Primitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm',
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = Primitive.Overlay.displayName;

export const DialogContent = forwardRef<
  ComponentRef<typeof Primitive.Content>,
  ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <Primitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border border-border bg-background p-6 shadow-lg duration-200 sm:rounded-lg',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className,
      )}
      {...props}
    >
      {children}
      <Primitive.Close
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
        aria-label="Close"
      >
        <X className="size-4" />
      </Primitive.Close>
    </Primitive.Content>
  </DialogPortal>
));
DialogContent.displayName = Primitive.Content.displayName;

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1.5 text-left', className)}
      {...props}
    />
  );
}
DialogHeader.displayName = 'DialogHeader';

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}
DialogFooter.displayName = 'DialogFooter';

export const DialogTitle = forwardRef<
  ComponentRef<typeof Primitive.Title>,
  ComponentPropsWithoutRef<typeof Primitive.Title>
>(({ className, ...props }, ref) => (
  <Primitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = Primitive.Title.displayName;

export const DialogDescription = forwardRef<
  ComponentRef<typeof Primitive.Description>,
  ComponentPropsWithoutRef<typeof Primitive.Description>
>(({ className, ...props }, ref) => (
  <Primitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = Primitive.Description.displayName;
