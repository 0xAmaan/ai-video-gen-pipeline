"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

interface NewProjectButtonProps {
  isCollapsed?: boolean;
  disabled?: boolean;
}

export const NewProjectButton = ({ isCollapsed, disabled }: NewProjectButtonProps) => {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    router.push("/new");
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors group ${
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-accent cursor-pointer"
      }`}
      title={isCollapsed ? "New Project" : undefined}
    >
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary group-hover:bg-primary/90 transition-colors flex-shrink-0">
        <Plus className="w-3 h-3 text-primary-foreground" />
      </div>
      {!isCollapsed && (
        <span className="text-sm font-medium text-foreground">New Project</span>
      )}
    </button>
  );
};
