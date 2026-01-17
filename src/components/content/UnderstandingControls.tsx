import { Callout } from './Callout';

export function UnderstandingControls() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
        Understanding the Controls
      </h2>
      
      <h3 className="text-lg sm:text-xl font-medium text-foreground pt-2">
        Problem Selection
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        Each problem represents a different structural scenario:
      </p>
      
      <ul className="space-y-4 text-muted-foreground">
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">MBB Beam:</strong> Named after Messerschmitt-Bolkow-Blohm (a German aerospace 
            company), this is the most famous test problem in topology optimization. It represents 
            a beam supported at both ends with a load in the middle. The result shows beautiful 
            diagonal bracing patterns.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">Cantilever:</strong> A beam fixed on one side with a load on the other—like 
            a diving board or a balcony. The optimal shape concentrates material along the top 
            and bottom edges, creating an I-beam-like cross-section.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">Bridge:</strong> Supported at both ends with weight distributed across the 
            top. This creates the classic arch shape that real bridges use, with material forming 
            a curved path from the load to the supports.
          </span>
        </li>
      </ul>
      
      <h3 className="text-lg sm:text-xl font-medium text-foreground pt-2">
        Material to Keep (Volume Fraction)
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        This slider controls how much of the original material must remain in the final design. 
        It&apos;s expressed as a percentage:
      </p>
      
      <ul className="space-y-3 text-muted-foreground">
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">Lower values (20-30%):</strong> Very lightweight designs with thin, delicate 
            structures. These are more efficient but may be harder to manufacture.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">Medium values (40-50%):</strong> A good balance between weight savings and 
            manufacturability. This is often used in practice.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">Higher values (60-80%):</strong> More robust designs with thicker members. 
            Less weight savings but easier to make and more forgiving of manufacturing defects.
          </span>
        </li>
      </ul>
      
      <Callout title="Try It!" type="tip">
        Change the volume fraction and watch how the optimal shape changes. With less material 
        available, the structure becomes more intricate with thinner members. With more material, 
        the structure becomes simpler and more solid.
      </Callout>
      
      <h3 className="text-lg sm:text-xl font-medium text-foreground pt-2">
        Resolution
      </h3>
      <p className="text-muted-foreground leading-relaxed">
        This controls how detailed the simulation is:
      </p>
      
      <ul className="space-y-3 text-muted-foreground">
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">60x20:</strong> Fastest computation, good for quick exploration. The shapes 
            may look a bit blocky.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-foreground/30 flex-shrink-0" />
          <span className="leading-relaxed">
            <strong className="text-foreground">120x40:</strong> Higher detail, but takes longer to compute. Use this to 
            see finer structural features.
          </span>
        </li>
      </ul>
      
      <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground pt-4">
        What to Watch For
      </h2>
      
      <p className="text-muted-foreground leading-relaxed">
        As you experiment with the demo, notice these interesting behaviors:
      </p>
      
      <ol className="space-y-4 text-muted-foreground list-none">
        <li className="flex gap-3">
          <span className="font-semibold text-foreground/50 tabular-nums">1.</span>
          <span className="leading-relaxed">
            <strong className="text-foreground">Early iterations are messy:</strong> At first, the design looks noisy with 
            lots of gray areas. This is normal—the algorithm is exploring different possibilities.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-foreground/50 tabular-nums">2.</span>
          <span className="leading-relaxed">
            <strong className="text-foreground">Structures crystallize:</strong> Around iteration 20-40, you&apos;ll see clear 
            structural members start to form as the gray areas resolve to black or white.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-foreground/50 tabular-nums">3.</span>
          <span className="leading-relaxed">
            <strong className="text-foreground">Final refinement:</strong> The last iterations make small adjustments to 
            member thicknesses and remove any remaining inefficient material.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="font-semibold text-foreground/50 tabular-nums">4.</span>
          <span className="leading-relaxed">
            <strong className="text-foreground">Diagonal patterns:</strong> Notice how forces &quot;flow&quot; through the structure 
            along diagonal paths. This is the most efficient way to transfer loads.
          </span>
        </li>
      </ol>
      
      <Callout title="Real-World Consideration" type="info">
        The shapes you see here are mathematically optimal, but real-world designs often need 
        modifications. Engineers might add minimum thickness constraints (so parts can be 
        manufactured), symmetry requirements (for aesthetics or assembly), or avoid certain 
        regions (where holes or attachments are needed).
      </Callout>
    </section>
  );
}

export default UnderstandingControls;
