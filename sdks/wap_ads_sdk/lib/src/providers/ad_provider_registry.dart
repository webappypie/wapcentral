import 'wap_ad_provider.dart';

/// Registry maintaining all active ad network provider adapters.
class AdProviderRegistry {
  final Map<String, WapAdProvider> _providers = {};

  AdProviderRegistry({List<WapAdProvider>? initialProviders}) {
    if (initialProviders != null) {
      for (final p in initialProviders) {
        register(p);
      }
    }
  }

  /// Register or override a provider.
  void register(WapAdProvider provider) {
    _providers[provider.id] = provider;
  }

  /// Remove a provider by ID.
  void unregister(String providerId) {
    _providers.remove(providerId);
  }

  /// Get provider by ID.
  WapAdProvider? get(String providerId) => _providers[providerId];

  /// List of all registered providers.
  List<WapAdProvider> get all => _providers.values.toList();

  /// Check whether a provider is registered.
  bool has(String providerId) => _providers.containsKey(providerId);

  /// Clear all registered providers.
  void clear() {
    _providers.clear();
  }
}
