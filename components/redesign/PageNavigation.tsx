"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Layout, Film, Scissors } from "lucide-react";

interface PageNavigationProps {
  projectId?: string;
  storyboardLocked?: boolean;
  storyboardLockMessage?: string;
  videoLocked?: boolean;
  videoLockMessage?: string;
  editorLocked?: boolean;
  editorLockMessage?: string;
}

const DEFAULT_PATH = "/home";

interface NavItem {
  name: string;
  icon: typeof Sparkles;
  href: string;
  match: string;
  disabled?: boolean;
  disabledMessage?: string;
}

export const PageNavigation = ({
  projectId,
  storyboardLocked,
  storyboardLockMessage,
  videoLocked,
  videoLockMessage,
  editorLocked,
  editorLockMessage,
}: PageNavigationProps) => {
  const pathname = usePathname();

  if (typeof window !== "undefined") {
    console.log("[PageNavigation] props", {
      projectId,
      storyboardLocked,
      videoLocked,
      editorLocked,
      pathname,
    });
  }

  const navItems: (NavItem | false)[] = [
    {
      name: "Home",
      icon: Layout,
      href: DEFAULT_PATH,
      match: "/home",
    },
    ...(projectId ? [{
      name: "Prompt Planner",
      icon: Sparkles,
      href: `/${projectId}/scene-planner`,
      match: "/scene-planner",
    },
    {
      name: "Storyboard",
      icon: Layout,
      href: `/${projectId}/storyboard`,
      match: "/storyboard",
      disabled: storyboardLocked,
      disabledMessage: storyboardLockMessage,
    },
    {
      name: "Video",
      icon: Film,
      href: `/${projectId}/video`,
      match: "/video",
      disabled: videoLocked,
      disabledMessage: videoLockMessage,
    },
    {
      name: "Video Editor",
      icon: Scissors,
      href: `/${projectId}/editor`,
      match: "/editor",
      disabled: editorLocked,
      disabledMessage: editorLockMessage,
    }] as NavItem[] : []),
  ];

  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg p-1">
      {navItems.filter((item): item is NavItem => Boolean(item)).map((item) => {
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
