"use client"
import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

// Remove utils import and add this directly
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

// Cast the Radix components to React.ElementType to satisfy the ElementType constraint
const RadixAvatarRootType = AvatarPrimitive.Root as unknown as React.ElementType;
const RadixAvatarImageType = AvatarPrimitive.Image as unknown as React.ElementType;
const RadixAvatarFallbackType = AvatarPrimitive.Fallback as unknown as React.ElementType;

// Update interface definitions to use the casted types
interface AvatarProps extends React.ComponentPropsWithoutRef<typeof RadixAvatarRootType> {
className?: string;
children?: React.ReactNode;
}
interface AvatarImageProps extends React.ComponentPropsWithoutRef<typeof RadixAvatarImageType> {
className?: string;
children?: React.ReactNode;
}
interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof RadixAvatarFallbackType> {
className?: string;
children?: React.ReactNode;
}

// Update the component implementations to use the casted types as well
const AvatarComponent = React.forwardRef<HTMLSpanElement, AvatarProps>((props, ref) => {
const { className, children, ...rest } = props;
const RadixAvatarRoot = AvatarPrimitive.Root as unknown as React.ElementType;
return (
<div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>
<RadixAvatarRoot ref={ref} {...rest}>
{children}
</RadixAvatarRoot>
</div>
);
});
AvatarComponent.displayName = AvatarPrimitive.Root.displayName;
export const Avatar = AvatarComponent;

const AvatarImageComponent = React.forwardRef<HTMLImageElement, AvatarImageProps>((props, ref) => {
const { className, children, ...rest } = props;
const RadixAvatarImage = AvatarPrimitive.Image as unknown as React.ElementType;
return (
<RadixAvatarImage
ref={ref}
className={cn("aspect-square h-full w-full", className)}
{...rest}
>
{children}
</RadixAvatarImage>
);
});
AvatarImageComponent.displayName = AvatarPrimitive.Image.displayName;
export const AvatarImage = AvatarImageComponent;

const AvatarFallbackComponent = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>((props, ref) => {
const { className, children, ...rest } = props;
const RadixAvatarFallback = AvatarPrimitive.Fallback as unknown as React.ElementType;
return (
<RadixAvatarFallback
ref={ref}
className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
{...rest}
>
{children}
</RadixAvatarFallback>
);
});
AvatarFallbackComponent.displayName = AvatarPrimitive.Fallback.displayName;
export const AvatarFallback = AvatarFallbackComponent;