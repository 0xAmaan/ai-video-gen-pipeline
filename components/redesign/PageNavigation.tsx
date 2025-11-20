"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Layout, Film, Scissors } from "lucide-react";

interface PageNavigationProps {
  projectId?: string;
  shotId?: string | null;
}

const DEFAULT_PATH = "/project-redesign/home";

export const PageNavigation = ({ projectId, shotId }: PageNavigationProps) => {
  const pathname = usePathname();
  const onPromptPlanner = pathname?.includes("/scene-planner");

  const navItems = [
    {
      name: "Home",
      icon: Layout,
      href: DEFAULT_PATH,
      match: "/project-redesign/home",
    },
    projectId && {
      name: "Prompt Planner",
      icon: Sparkles,
      href: projectId
        ? `/project-redesign/${projectId}/scene-planner`
        : DEFAULT_PATH,
      match: "/scene-planner",
    },
    projectId && {
      name: "Scene Iterator",
      icon: Film,
      href: projectId
        ? `/project-redesign/${projectId}/scene-iterator${
            shotId ? `?shotId=${shotId}` : ""
          }`
        : DEFAULT_PATH,
      match: "/scene-iterator",
      disabled: onPromptPlanner && !shotId,
    },
    projectId && {
      name: "Storyboard",
      icon: Layout,
      href: projectId
        ? `/project-redesign/${projectId}/storyboard`
        : DEFAULT_PATH,
      match: "/storyboard",
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
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-500/50 cursor-not-allowed"
              aria-disabled="true"
              title="Select a shot to open the Scene Iterator"
            >
              <Icon className="w-4 h-4" />
              {item.name}
            </div>
          );
        }

        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
              isActive
                ? "bg-white text-black"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#3a3a3a]",
            )}
          >
            <Icon className="w-4 h-4" />
            {item.name}
          </Link>
        );
      })}
    </div>
  );
};
