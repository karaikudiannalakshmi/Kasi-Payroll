# Kasi Kitchen Payroll — KVKF Varanasi

## Setup

### 1. Firebase Setup
1. Go to console.firebase.google.com
2. Create project → Enable Firestore (asia-south1) + Authentication (Email/Password)
3. Add Web App → copy config values

### 2. Create Users in Firebase Auth
- Go to Authentication → Users → Add user
- Admin: admin@kasikvkf.com / your_password
- Operator: operator@kasikvkf.com / your_password

### 3. Set User Roles in Firestore
In Firestore → users collection, create documents:
- Document ID = Firebase UID of admin user → { "role": "admin" }
- Document ID = Firebase UID of operator user → { "role": "operator" }

### 4. Vercel Deployment
1. Push to GitHub
2. Import to Vercel → add 6 VITE_FIREBASE_* env variables
3. Deploy

### 5. Firestore Rules
Paste firestore.rules content in Firebase Console → Firestore → Rules → Publish

## Monthly Workflow
1. Attendance → Import Excel attendance
2. Advances → Record advances (deduct month auto-set from date)
3. Salary → Recalculate → Export Bank Upload → Finalise
4. New month → Advances start blank (pending ones from previous month are cleared)

## Roles
- **Admin**: Full access — Employees, Attendance, Salary, Daily Sheet, Advances, Loans
- **Operator**: Attendance only
