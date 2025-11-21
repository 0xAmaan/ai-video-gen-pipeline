export const LoadingStep = () => {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="w-full max-w-3xl px-4 text-center">
        <div className="bg-card border border-border rounded-xl p-12 shadow-xl shadow-black/40">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <h2 className="text-2xl font-semibold">
              Generating Clarifying Questions...
            </h2>
            <p className="text-muted-foreground">
              Our AI is analyzing your prompt to create personalized questions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

