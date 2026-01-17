import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { Introduction } from '@/components/content/Introduction';
import { HowItWorks } from '@/components/content/HowItWorks';
import { UnderstandingControls } from '@/components/content/UnderstandingControls';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Article Container - max-w-7xl for visualizer, content constrained within */}
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        
        {/* Header with Theme Toggle - constrained width, centered */}
        <header className="max-w-3xl mx-auto mb-10 lg:mb-12">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-3">
                Topology Optimization
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground font-light">
                How computers design structures by learning from nature
              </p>
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        {/* Subtle section divider - centered and symmetric */}
        <div className="max-w-3xl mx-auto mb-10 lg:mb-12 flex items-center justify-center">
          <div className="w-16 h-px bg-border" />
        </div>
        
        {/* Introduction - constrained prose width, centered */}
        <div className="max-w-3xl mx-auto">
          <Introduction />
        </div>
        
        {/* Section spacer with subtle dots */}
        <div className="my-12 lg:my-16 flex items-center justify-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        
        {/* Interactive Demo Section - full width */}
        <section>
          <div className="max-w-3xl mx-auto mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-3">
              Try It Yourself
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Watch the optimization happen in real-time. Click &quot;Start&quot; to begin, and experiment 
              with different problems and settings.
            </p>
          </div>
          
          {/* Visualizer uses full container width */}
          <TopologyVisualizer className="mb-8" />
        </section>
        
        {/* Section spacer with subtle dots */}
        <div className="my-12 lg:my-16 flex items-center justify-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        
        {/* How It Works - constrained prose width, centered */}
        <div className="max-w-3xl mx-auto">
          <HowItWorks />
        </div>
        
        {/* Section spacer with subtle dots */}
        <div className="my-12 lg:my-16 flex items-center justify-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        
        {/* Understanding Controls - constrained prose width, centered */}
        <div className="max-w-3xl mx-auto">
          <UnderstandingControls />
        </div>
        
        {/* Footer - centered */}
        <footer className="max-w-3xl mx-auto mt-16 lg:mt-20 pt-8 lg:pt-10 border-t border-border/50">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">
              This interactive demonstration uses the SIMP (Solid Isotropic Material with Penalization) 
              method, a widely-used topology optimization algorithm developed in the 1980s and 1990s.
            </p>
            <p className="text-xs text-muted-foreground/70">
              The algorithm runs entirely in your browser using JavaScript. No data is sent to any server.
            </p>
          </div>
        </footer>
        
      </article>
    </main>
  );
}
