import "@/app/globals.css";

import { Inter } from "next/font/google";

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
    <html lang="en">
      <body
        className={`${inter.className} bg-background-base text-foreground h-screen p-3`}
      >
        {/* Main Content */}
        <main>{children}</main>
      </body>
    </html>
  );
};

export default RootLayout;
