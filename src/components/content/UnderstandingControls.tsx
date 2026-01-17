import { Callout } from './Callout';

export function UnderstandingControls() {
  return (
    <section className="prose max-w-none">
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        Understanding the Controls
      </h2>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Problem Selection
      </h3>
      <p className="text-muted-foreground">
        Each problem represents a different structural scenario:
      </p>
      
      <ul className="list-disc pl-6 space-y-3 text-muted-foreground">
        <li>
          <strong className="text-foreground">MBB Beam:</strong> Named after Messerschmitt-Bolkow-Blohm (a German aerospace 
          company), this is the most famous test problem in topology optimization. It represents 
          a beam supported at both ends with a load in the middle. The result shows beautiful 
          diagonal bracing patterns.
        </li>
        <li>
          <strong className="text-foreground">Cantilever:</strong> A beam fixed on one side with a load on the other—like 
          a diving board or a balcony. The optimal shape concentrates material along the top 
          and bottom edges, creating an I-beam-like cross-section.
        </li>
        <li>
          <strong className="text-foreground">Bridge:</strong> Supported at both ends with weight distributed across the 
          top. This creates the classic arch shape that real bridges use, with material forming 
          a curved path from the load to the supports.
        </li>
      </ul>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Material to Keep (Volume Fraction)
      </h3>
      <p className="text-muted-foreground">
        This slider controls how much of the original material must remain in the final design. 
        It&apos;s expressed as a percentage:
      </p>
      
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">Lower values (20-30%):</strong> Very lightweight designs with thin, delicate 
          structures. These are more efficient but may be harder to manufacture.
        </li>
        <li>
          <strong className="text-foreground">Medium values (40-50%):</strong> A good balance between weight savings and 
          manufacturability. This is often used in practice.
        </li>
        <li>
          <strong className="text-foreground">Higher values (60-80%):</strong> More robust designs with thicker members. 
          Less weight savings but easier to make and more forgiving of manufacturing defects.
        </li>
      </ul>
      
      <Callout title="Try It!" type="tip">
        Change the volume fraction and watch how the optimal shape changes. With less material 
        available, the structure becomes more intricate with thinner members. With more material, 
        the structure becomes simpler and more solid.
      </Callout>
      
      <h3 className="text-xl font-semibold text-foreground mt-6 mb-3">
        Resolution
      </h3>
      <p className="text-muted-foreground">
        This controls how detailed the simulation is:
      </p>
      
      <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
        <li>
          <strong className="text-foreground">60x20:</strong> Fastest computation, good for quick exploration. The shapes 
          may look a bit blocky.
        </li>
        <li>
          <strong className="text-foreground">90x30:</strong> A good balance between speed and detail.
        </li>
        <li>
          <strong className="text-foreground">120x40:</strong> Highest detail, but takes longer to compute. Use this to 
          see finer structural features.
        </li>
      </ul>
      
      <h2 className="text-2xl font-semibold text-foreground mt-8 mb-4">
        What to Watch For
      </h2>
      
      <p className="text-muted-foreground">
        As you experiment with the demo, notice these interesting behaviors:
      </p>
      
      <ol className="list-decimal pl-6 space-y-3 text-muted-foreground">
        <li>
          <strong className="text-foreground">Early iterations are messy:</strong> At first, the design looks noisy with 
          lots of gray areas. This is normal—the algorithm is exploring different possibilities.
        </li>
        <li>
          <strong className="text-foreground">Structures crystallize:</strong> Around iteration 20-40, you&apos;ll see clear 
          structural members start to form as the gray areas resolve to black or white.
        </li>
        <li>
          <strong className="text-foreground">Final refinement:</strong> The last iterations make small adjustments to 
          member thicknesses and remove any remaining inefficient material.
        </li>
        <li>
          <strong className="text-foreground">Diagonal patterns:</strong> Notice how forces &quot;flow&quot; through the structure 
          along diagonal paths. This is the most efficient way to transfer loads.
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
