import "@/app/globals.css";

import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "./ConvexClientProvider";
import { LayoutWrapper } from "./LayoutWrapper";

const inter = Inter({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata = {
  title: "AI Video Gen Pipeline",
  description: "AI Video Gen Pipeline",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${inter.className} bg-background-base text-foreground h-screen overflow-hidden`}
        >
          <ConvexClientProvider>
            <LayoutWrapper>{children}</LayoutWrapper>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
};

export default RootLayout;
