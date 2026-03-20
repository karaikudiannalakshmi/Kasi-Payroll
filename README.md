# 🕉️ Kasi Kitchen Payroll — Deployment Guide

**Kasi Visvanathar Koviloor Foundation · Varanasi Kitchen**

---

## What This App Does

| Feature | Details |
|---|---|
| **Employees** | Add/edit staff, store IFSC, Account No, Bank Bene ID |
| **Attendance** | Monthly grid, 9h = 1 day, click header to mark Paid Holiday |
| **Paid Holidays** | Base 9h auto-credited; extra hours worked on holiday added on top |
| **Salary Calc** | Gross = total effective hours × (salary ÷ 26 ÷ 9) |
| **Advances** | Record advances, tag deduction month, per-employee summary |
| **Loans** | Principal + EMI, payment history, balance progress bar, auto-close |
| **Bank Upload** | Exports exact NEFT format matching your existing CIB template |
| **Payslips** | Printable slip per employee + Excel batch export |

---

## STEP 1 — Create Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **Add project** → Name: `kasi-payroll` → Continue
3. Disable Google Analytics (not needed) → **Create project**
4. In left sidebar → **Build → Firestore Database**
5. Click **Create database** → Start in **test mode** → Choose region **asia-south1 (Mumbai)** → Done
6. In left sidebar → **Project Settings** (gear icon) → **Your apps** → click **</>** (Web)
7. App nickname: `Kasi Payroll Web` → **Register app**
8. Copy the `firebaseConfig` object — you'll need it in Step 3

---

## STEP 2 — Push Code to GitHub

```bash
cd kasi-payroll

# Initialise git
git init
git add .
git commit -m "Initial commit — Kasi Kitchen Payroll"

# Create repo on github.com (name: kasi-payroll, private recommended)
# Then:
git remote add origin https://github.com/karaikudiannalakshmi/kasi-payroll.git
git branch -M main
git push -u origin main
```

---

## STEP 3 — Deploy on Vercel

1. Go to **https://vercel.com** → Log in with GitHub
2. Click **Add New Project** → Import `kasi-payroll` repo
3. Framework: **Vite** (auto-detected)
4. **Environment Variables** — add each one:

| Variable | Value (from Firebase config) |
|---|---|
| `VITE_FIREBASE_API_KEY` | `apiKey` value |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` value |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` value |
| `VITE_FIREBASE_STORAGE_BUCKET` | `storageBucket` value |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` value |
| `VITE_FIREBASE_APP_ID` | `appId` value |

5. Click **Deploy** → Wait ~2 minutes
6. Your app is live at: `https://kasi-payroll.vercel.app` (or similar)

---

## STEP 4 — Set Firestore Security Rules

In Firebase Console → Firestore → **Rules** tab, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ This is open access for now. Add Firebase Authentication later for production security.

---

## STEP 5 — Seed Employee Data

After the app is live:

1. Go to **Employees** page
2. Click **+ Add Employee** for each staff member
3. Fill in: Name, Designation, Monthly Salary, IFSC, Account No, **Bene ID** (most important for bank upload)

**February 2026 employees and Bene IDs** (from your Excel):

| Name | Salary | Bene ID |
|---|---|---|
| Anil Shahni | 12,000 | 271214084 |
| Anil Yadav | 15,000 | 261082207 |
| Dinesh Deovanshi | 18,000 | 264577676 |
| Karan Sahani | 12,000 | 261082212 |
| Krishna Kumar | 12,000 | 261082219 |
| Pramod Sahani | 12,000 | 261082218 |
| Sachin | 12,000 | 261082229 |
| Saurabh Awasthi | 33,000 | 267875017 |
| Shubham Chaurasiya | 15,000 | 261082230 |
| Vijay Kumar | 12,000 | 261082210 |
| Vinay Deovanshi (Sonu) | 15,000 | 261082221 |
| Deepak Kumar | 12,000 | 271210305 |
| Rahul | 12,000 | 271211291 |
| Shiv Mishra | 22,000 | 271214082 |
| Laxmi Devi | 12,000 | 261082211 |
| Shivani Singh | 12,000 | 261082213 |
| Ritu Yadav | 15,000 | 261082217 |
| Archna | 12,000 | 261082227 |
| Roshani | 12,000 | 261082228 |
| Arti Devi | 12,000 | 271214083 |
| Krishna Jha | 12,000 | 261082232 |
| Pratima | 12,000 | 271529520 |
| Rinku Seth | 12,000 | 271211742 |
| Ravi Shanker Tiwari | 12,000 | 261082209 |
| Vijay Kumar Gupta | 12,000 | 274964108 |
| Karan Bharti | 12,000 | 275608534 |
| Manya | 12,000 | 274965395 |
| Shweta Pandey | 12,000 | 276889530 |
| Abhishek Bharti | 12,000 | 275608534 |
| Nagendra Sahani | 15,000 | 280620307 |
| Meera Rai | 12,000 | 278931211 |
| Neelam Mishra | 12,000 | 278998780 |
| Anita Gupta | 12,000 | 282071350 |
| Rohit Kumar | 12,000 | 282071037 |

---

## Monthly Workflow

```
1. START OF MONTH
   └─ Attendance → select month → click dates to mark Paid Holidays
   └─ Enter daily hours for each employee (9 = full day)
   └─ For holidays: enter EXTRA hours only (e.g., 3 means 9+3=12h credited)

2. MID-MONTH (as needed)
   └─ Advances → Record Advance → pick employee + amount + deduct month

3. END OF MONTH
   └─ Salary → Recalculate → review all rows
   └─ Salary → Export Bank Upload → upload to CIB portal
   └─ Salary → Finalise & Save Salary → locks records
   └─ Loans → Record EMI → update balances
```

---

## Salary Formula

```
Daily Rate    = Monthly Salary ÷ 26
Hourly Rate   = Daily Rate ÷ 9

Regular Day   = hours × hourly rate
Holiday (off) = 9h auto-credited (paid holiday)
Holiday (worked) = (9 + extra_hours) × hourly rate
Gross Salary  = total effective hours × hourly rate  [rounded to ₹]
Net Pay       = Gross − Advance Deductions − Loan EMIs
```

---

## Local Development (optional)

```bash
cd kasi-payroll
npm install
cp .env.example .env.local   # fill in Firebase keys
npm run dev                   # opens http://localhost:5173
```

---

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **Database**: Firebase Firestore (cloud, real-time)
- **Hosting**: Vercel (auto-deploy on git push)
- **Export**: SheetJS (xlsx) — bank upload + salary Excel
