"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Sparkles, Layout, Film, Scissors } from "lucide-react";

const navItems = [
  {
    name: "Prompt Planner",
    path: "/project-redesign/scene-planner",
    icon: Sparkles,
  },
  {
    name: "Scene Iterator",
    path: "/project-redesign/scene-iterator",
    icon: Film,
  },
  {
    name: "Storyboard",
    path: "/project-redesign/storyboard",
    icon: Layout,
  },
  {
    name: "Video Editor",
    path: "/project-redesign/home",
    icon: Scissors,
  },
];

export const PageNavigation = () => {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] rounded-lg p-1">
      {navItems.map((item) => {
        const isActive = pathname === item.path;
        const Icon = item.icon;

        return (
          <Link
            key={item.path}
            href={item.path}
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
