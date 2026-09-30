import type { IProvider } from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, IProvider>();

  registerProvider(provider: IProvider): void {
    if (!provider || !provider.providerId) {
      throw new Error('Cannot register provider with undefined or empty providerId');
    }
    this.providers.set(provider.providerId, provider);
  }

  getProvider(providerId: string): IProvider | undefined {
    return this.providers.get(providerId);
  }

  hasProvider(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  listProviders(): IProvider[] {
    return Array.from(this.providers.values());
  }

  removeProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  clear(): void {
    this.providers.clear();
  }
}

/**
 * Singleton instance of ProviderRegistry for global service runtime use.
 */
export const defaultProviderRegistry = new ProviderRegistry();
