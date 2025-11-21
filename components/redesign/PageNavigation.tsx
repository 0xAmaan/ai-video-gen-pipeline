"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Layout, Film, Scissors } from "lucide-react";

interface PageNavigationProps {
  projectId?: string;
  storyboardLocked?: boolean;
  storyboardLockMessage?: string;
}

const DEFAULT_PATH = "/home";

export const PageNavigation = ({ projectId, storyboardLocked, storyboardLockMessage }: PageNavigationProps) => {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Home",
      icon: Layout,
      href: DEFAULT_PATH,
      match: "/home",
    },
    projectId && {
      name: "Prompt Planner",
      icon: Sparkles,
      href: projectId
        ? `/${projectId}/scene-planner`
        : DEFAULT_PATH,
      match: "/scene-planner",
    },
    projectId && {
      name: "Storyboard",
      icon: Layout,
      href: projectId
        ? `/${projectId}/storyboard`
        : DEFAULT_PATH,
      match: "/storyboard",
      disabled: storyboardLocked,
      disabledMessage: storyboardLockMessage,
    },
    projectId && {
      name: "Video Editor",
      icon: Scissors,
      href: DEFAULT_PATH,
      match: "/video-editor",
    },
  ];

  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg p-1">
      {navItems.filter(Boolean).map((item) => {
        const isActive = pathname?.includes(item.match);
        const Icon = item.icon;
        const isDisabled = item.disabled;

        if (isDisabled) {
          return (
            <div
              key={item.name}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-500/50 cursor-not-allowed whitespace-nowrap"
              aria-disabled="true"
              title={item.disabledMessage || "This page is currently locked"}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.name}
            </div>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer whitespace-nowrap",
              isActive
                ? "bg-white text-black"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#3a3a3a]",
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
};
