/**
 * Test double for a MAGENAIS `CapabilityGraph`, implementing only the
 * `CapabilityGraphLike` surface (`providersOf`). Same semantics as
 * `CapabilityGraph.fromManifests()` for that query: providers are
 * deduplicated per capability and kept in manifest insertion order.
 */
import type { CapabilityGraphLike, ModelManifest } from '../../src/contract.ts';

export class CapabilityGraph implements CapabilityGraphLike {
  private readonly providers: Map<string, string[]>;

  private constructor(providers: Map<string, string[]>) {
    this.providers = providers;
  }

  static fromManifests(manifests: readonly Pick<ModelManifest, 'id' | 'capabilities'>[]): CapabilityGraph {
    const providers = new Map<string, string[]>();
    for (const manifest of manifests) {
      for (const capability of manifest.capabilities ?? []) {
        const list = providers.get(capability) ?? [];
        if (!list.includes(manifest.id)) list.push(manifest.id);
        providers.set(capability, list);
      }
    }
    return new CapabilityGraph(providers);
  }

  providersOf(capability: string): string[] {
    return [...(this.providers.get(capability) ?? [])];
  }
}
