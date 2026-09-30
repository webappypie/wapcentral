# Infrastructure — Firebase Configuration

This directory contains Firebase configuration files for each environment.

## Structure
```
infrastructure/
└── firebase/
    ├── README.md                      (this file)
    ├── .firebaserc.example            (project aliases template)
    ├── firebase.json                  (hosting + emulator config)
    ├── firestore.rules                (Firestore security rules — Phase 1)
    ├── firestore.indexes.json         (Firestore composite indexes — Phase 1)
    ├── storage.rules                  (Storage security rules — Phase 1)
    └── remoteconfig.template.json     (Remote Config template — Phase 1)
```

## Firebase Projects (Phase 1)
- `wapcentral-dev` — development
- `wapcentral-staging` — staging
- `wapcentral-prod` — production

## Usage
```bash
# Switch to development environment
firebase use development

# Switch to production (requires explicit confirmation)
firebase use production

# Deploy hosting only
firebase deploy --only hosting

# Run emulator suite for local development
firebase emulators:start
```

## Phase 0 Note
Firebase project IDs and real config values are NOT committed.
See `.firebaserc.example` for the template.
Real `.firebaserc` (with project IDs) must be created locally after running:
  firebase use --add
