"use client"

import { Menu as MenuPrimitive } from "@base-ui/react/menu"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuTrigger({ className, ...props }: MenuPrimitive.Trigger.Props) {
  return (
    <MenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-[13px] font-medium text-ink",
        "transition-colors duration-120 hover:bg-surface-secondary data-[popup-open]:bg-surface-secondary",
        className,
      )}
      {...props}
    />
  )
}

const popupClass =
  "z-50 min-w-[11rem] origin-var(--transform-origin) overflow-hidden rounded-xl border border-border bg-surface p-1 " +
  "shadow-lg transition-[transform,opacity] duration-150 ease-out " +
  "data-starting-style:scale-[0.97] data-starting-style:opacity-0 " +
  "data-ending-style:scale-[0.97] data-ending-style:opacity-0"

type MenuAlign = "start" | "center" | "end"

function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: MenuPrimitive.Popup.Props & { align?: MenuAlign; sideOffset?: number }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner sideOffset={sideOffset} align={align}>
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(popupClass, className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

const itemBase =
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] " +
  "text-ink outline-none transition-colors duration-100 " +
  "data-highlighted:bg-surface-secondary data-disabled:pointer-events-none data-disabled:opacity-45"

function DropdownMenuItem({
  className,
  destructive,
  ...props
}: MenuPrimitive.Item.Props & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(itemBase, destructive && "text-danger data-highlighted:bg-danger/10", className)}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({ className, children, ...props }: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(itemBase, "pr-8", className)}
      {...props}
    >
      <MenuPrimitive.CheckboxItemIndicator className="absolute right-2.5">
        <Check className="size-3.5" strokeWidth={2} />
      </MenuPrimitive.CheckboxItemIndicator>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuLabel({ className, ...props }: MenuPrimitive.Item.Props) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-label"
      className={cn(
        "px-2.5 py-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] text-faint",
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
