import "@/app/globals.css";

import { Inter } from "next/font/google";
import { RootProviders } from "./root-providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "AI Video Gen Pipeline",
  description: "AI Video Gen Pipeline",
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background-base text-foreground h-screen overflow-hidden`}>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
};

export default RootLayout;
