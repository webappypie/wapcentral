import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const db = getFirestore(app);

const platformApps = [
  {
    id: 'filezen',
    name: 'FileZen — AI File & Document Manager',
    packageId: 'com.webappypie.filezen',
    platform: 'android',
    version: '1.0.0',
    sdkVersion: '0.1.0',
    environment: 'production',
    status: 'active',
    appKey: 'wap_key_filezen_prod',
    allowedServices: ['ai', 'ocr', 'files', 'ads', 'notifications'],
    enabledModules: ['ai', 'ocr', 'file_intelligence', 'promotion', 'analytics', 'ads', 'notifications'],
    serviceQuotas: {
      ai: { dailyRequests: 5000, rateLimitRpm: 60 },
      ocr: { dailyRequests: 2000, rateLimitRpm: 40 },
      files: { dailyRequests: 10000, rateLimitRpm: 120 },
      ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
    },
    killSwitch: false,
  },
  {
    id: 'optilens',
    name: 'OptiLens AI — Smart Camera & Photo Enhancer',
    packageId: 'com.webappypie.optilens',
    platform: 'android',
    version: '1.0.0',
    sdkVersion: '0.1.0',
    environment: 'production',
    status: 'active',
    appKey: 'wap_key_optilens_prod',
    allowedServices: ['image', 'ai', 'ads', 'notifications'],
    enabledModules: ['image_intelligence', 'ai', 'promotion', 'analytics', 'ads', 'notifications'],
    serviceQuotas: {
      image: { dailyRequests: 3000, rateLimitRpm: 50 },
      ai: { dailyRequests: 1000, rateLimitRpm: 30 },
      ads: { dailyRequests: 50000, rateLimitRpm: 300 },
      notifications: { dailyRequests: 50000, rateLimitRpm: 300 },
    },
    killSwitch: false,
  },
];

async function seedPlatformApps() {
  console.log('=== Registering Platform Applications in Firestore wapcentral-prod ===');

  for (const appData of platformApps) {
    const docRef = db.collection('apps').doc(appData.id);
    const existing = await docRef.get();

    if (!existing.exists) {
      console.log(`Creating application registration "${appData.name}" (${appData.id})...`);
      await docRef.set({
        ...appData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`✅ App "${appData.name}" (${appData.id}) successfully created in Firestore.`);
    } else {
      console.log(`Updating service permissions for "${appData.name}" (${appData.id})...`);
      await docRef.set(
        {
          allowedServices: appData.allowedServices,
          enabledModules: appData.enabledModules,
          serviceQuotas: appData.serviceQuotas,
          appKey: appData.appKey,
          status: appData.status,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      console.log(`✅ App "${appData.name}" (${appData.id}) updated in Firestore.`);
    }
  }

  console.log('\n=== Platform apps registration complete ===');
}

seedPlatformApps().catch((err) => {
  console.error('❌ Failed to seed platform apps:', err);
  process.exit(1);
});
