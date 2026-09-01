import { colorForUser, initialsForName } from "@/lib/user-color"
import { cn } from "@/lib/utils"

export function UserAvatar({
  userId,
  name,
  className,
}: {
  userId: number
  name: string
  className?: string
}) {
  const { color } = colorForUser(userId)
  return (
    <div
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white",
        className
      )}
      style={{ backgroundColor: color }}
    >
      {initialsForName(name)}
    </div>
  )
}
