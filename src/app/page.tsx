import { TopologyVisualizer } from '@/components/visualization/TopologyVisualizer';
import { Introduction } from '@/components/content/Introduction';
import { HowItWorks } from '@/components/content/HowItWorks';
import { UnderstandingControls } from '@/components/content/UnderstandingControls';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      {/* Article Container */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Topology Optimization
          </h1>
          <p className="text-xl text-gray-500">
            How computers design structures by learning from nature
          </p>
        </header>
        
        {/* Divider */}
        <hr className="border-gray-200 mb-8" />
        
        {/* Introduction */}
        <Introduction />
        
        {/* Divider */}
        <hr className="border-gray-200 my-10" />
        
        {/* Interactive Demo Section */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Try It Yourself
          </h2>
          <p className="text-gray-600 mb-6">
            Watch the optimization happen in real-time. Click &quot;Start&quot; to begin, and experiment 
            with different problems and settings.
          </p>
          
          <TopologyVisualizer className="mb-8" />
        </section>
        
        {/* Divider */}
        <hr className="border-gray-200 my-10" />
        
        {/* How It Works */}
        <HowItWorks />
        
        {/* Divider */}
        <hr className="border-gray-200 my-10" />
        
        {/* Understanding Controls */}
        <UnderstandingControls />
        
        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <p className="mb-2">
              This interactive demonstration uses the SIMP (Solid Isotropic Material with Penalization) 
              method, a widely-used topology optimization algorithm developed in the 1980s and 1990s.
            </p>
            <p>
              The algorithm runs entirely in your browser using JavaScript. No data is sent to any server.
            </p>
          </div>
        </footer>
        
      </article>
    </main>
  );
}
