import { COLLECTIONS } from '@wapcentral/config';
import type { PlatformKillSwitchConfig, PlatformServiceType } from '@wapcentral/types';
import { getFirestoreDb } from '../../services/firestore.js';

let state: PlatformKillSwitchConfig = {
  global: false,
  services: {
    ai: false,
    image: false,
    ocr: false,
    files: false,
    promotion: false,
    ads: false,
  },
  apps: {},
  providers: {},
};

export function getKillSwitchState(): PlatformKillSwitchConfig {
  return {
    global: state.global,
    services: { ...state.services },
    apps: { ...state.apps },
    providers: { ...state.providers },
  };
}

export function isGlobalKillSwitchActive(): boolean {
  return state.global;
}

export function isServiceKillSwitched(service: PlatformServiceType): boolean {
  if (state.global) return true;
  return !!state.services[service];
}

export function isAppKillSwitched(appId: string): boolean {
  if (state.global) return true;
  return !!state.apps[appId];
}

export function isProviderKillSwitched(providerId: string): boolean {
  return !!state.providers[providerId];
}

export function setGlobalKillSwitch(active: boolean): void {
  state.global = active;
}

export function setServiceKillSwitch(service: PlatformServiceType, active: boolean): void {
  state.services[service] = active;
}

export function setAppKillSwitch(appId: string, active: boolean): void {
  state.apps[appId] = active;
}

export function setProviderKillSwitch(providerId: string, active: boolean): void {
  state.providers[providerId] = active;
}

export async function persistKillSwitches(): Promise<void> {
  try {
    const db = getFirestoreDb();
    await db.collection(COLLECTIONS.PLATFORM_KILL_SWITCHES).doc('config').set({
      ...state,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Non-blocking in ephemeral tests
  }
}

export async function loadKillSwitchesFromFirestore(): Promise<void> {
  try {
    const db = getFirestoreDb();
    const doc = await db.collection(COLLECTIONS.PLATFORM_KILL_SWITCHES).doc('config').get();
    if (doc.exists) {
      const data = doc.data() as Partial<PlatformKillSwitchConfig> | undefined;
      if (data) {
        state = {
          global: data.global ?? false,
          services: { ...state.services, ...data.services },
          apps: { ...state.apps, ...data.apps },
          providers: { ...state.providers, ...data.providers },
        };
      }
    }
  } catch {
    // Non-blocking
  }
}

export function resetKillSwitchesForTest(): void {
  state = {
    global: false,
    services: {
      ai: false,
      image: false,
      ocr: false,
      files: false,
      promotion: false,
      ads: false,
    },
    apps: {},
    providers: {},
  };
}
