import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'wapcentral-prod',
});

const db = getFirestore(app);

const initialApps = [
  {
    id: 'app_01',
    name: 'WebAppyPie Reader',
    packageId: 'com.webappypie.reader',
    platform: 'android',
    version: '1.2.0',
    environment: 'production',
    enabledModules: ['promotion', 'ads', 'analytics'],
    adConfig: {
      admob: {
        appId: 'ca-app-pub-3940256099942544~3347511713',
        enabled: true,
        adUnits: [
          {
            id: 'unit_banner_01',
            name: 'Reader Main Banner',
            type: 'banner',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/6300978111',
          },
          {
            id: 'unit_interstitial_01',
            name: 'Chapter End Interstitial',
            type: 'interstitial',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/1033173712',
          },
          {
            id: 'unit_rewarded_01',
            name: 'Unlock Premium Feature',
            type: 'rewarded',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/5224354917',
          },
          {
            id: 'unit_native_01',
            name: 'In-Feed Native Ad',
            type: 'native',
            platform: 'android',
            adUnitId: 'ca-app-pub-3940256099942544/2247696110',
          },
        ],
      },
      meta: {
        appId: '102938475610293',
        enabled: true,
        placements: [
          {
            id: 'meta_banner_01',
            name: 'Meta Footer Banner',
            type: 'banner',
            placementId: '102938475610293_102938475610294',
          },
        ],
      },
      applovin: {
        sdkKey: 'applovin_sdk_key_live_abcdef1234567890',
        enabled: true,
        adUnits: [
          {
            id: 'max_banner_01',
            name: 'MAX Mediated Banner',
            type: 'banner',
            platform: 'android',
            adUnitId: 'max_unit_banner_9988',
          },
        ],
      },
      wapads: {
        appKey: 'wap_key_reader_prod',
        enabled: true,
      },
      mediationPriority: ['admob', 'meta', 'applovin', 'wapads'],
    },
    status: 'active',
  },
  {
    id: 'app_02',
    name: 'Pie Calc Pro',
    packageId: 'com.webappypie.calc',
    bundleId: 'com.webappypie.calc',
    platform: 'ios',
    version: '2.0.4',
    environment: 'production',
    enabledModules: ['ads', 'promotion'],
    adConfig: {
      admob: {
        appId: 'ca-app-pub-3940256099942544~1458782514',
        enabled: true,
        adUnits: [
          {
            id: 'calc_banner_ios',
            name: 'Calc Bottom Banner',
            type: 'banner',
            platform: 'ios',
            adUnitId: 'ca-app-pub-3940256099942544/2934735716',
          },
        ],
      },
      meta: {
        appId: '987654321098765',
        enabled: false,
        placements: [],
      },
      applovin: {
        sdkKey: 'applovin_sdk_key_calc_ios_123',
        enabled: true,
        adUnits: [],
      },
      wapads: {
        appKey: 'wap_key_calc_prod',
        enabled: true,
      },
      mediationPriority: ['admob', 'applovin', 'wapads'],
    },
    status: 'active',
  },
  {
    id: 'app_03',
    name: 'WAP Notes AI',
    packageId: 'com.webappypie.notes',
    platform: 'android',
    version: '0.9.5',
    environment: 'staging',
    enabledModules: ['ai', 'promotion', 'analytics'],
    status: 'active',
  },
];

async function seedApps() {
  console.log('=== Migrating App Registry to Firestore wapcentral-prod ===');
  for (const appData of initialApps) {
    const docRef = db.collection('apps').doc(appData.id);
    const existing = await docRef.get();
    if (!existing.exists) {
      console.log(`Seeding app "${appData.name}" (${appData.id})...`);
      await docRef.set({
        ...appData,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`✅ App "${appData.name}" (${appData.id}) successfully created in Firestore.`);
    } else {
      console.log(`ℹ️ App "${appData.name}" (${appData.id}) already exists in Firestore.`);
    }
  }

  // Seed initial audit log in Firestore
  console.log('\n=== Seeding initial audit log in Firestore ===');
  const auditSnap = await db.collection('auditLogs').limit(1).get();
  if (auditSnap.empty) {
    await db.collection('auditLogs').add({
      action: 'system.bootstrap',
      actorUid: 'usr_superadmin',
      actorEmail: 'admin@webappypie.com',
      resourceType: 'appRegistry',
      resourceId: 'all',
      timestamp: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      metadata: { note: 'App Registry migrated to Firestore' },
    });
    console.log('✅ Initial audit log seeded in Firestore.');
  } else {
    console.log('ℹ️ Audit logs already exist in Firestore.');
  }
}

seedApps().catch((err) => {
  console.error('❌ Seeding failed:', err);
  process.exit(1);
});

