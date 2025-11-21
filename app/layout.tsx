import "@/app/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { LayoutWrapper } from "./LayoutWrapper";

export const metadata = {
  title: "AI Video Gen Pipeline",
  description: "AI Video Gen Pipeline",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-background-base text-foreground h-screen overflow-hidden font-sans">
          <ConvexClientProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
};

export default RootLayout;
