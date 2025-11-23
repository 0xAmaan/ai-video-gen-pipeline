import "@/app/globals.css";

const RemotionLayout = ({ children }: { children: React.ReactNode }) => {
  return <div className="min-h-screen overflow-auto bg-background text-foreground">{children}</div>;
};

export default RemotionLayout;
