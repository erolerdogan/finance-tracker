# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

In the output, you'll find options to open the app in a

development build

Android emulator

iOS simulator

Expo Go, a limited sandbox for trying out app development with Expo

This project uses Expo Router for file-based routing.

Features & Capabilities
👥 Multi-Profile Support
Manage separate ledger spaces within a single app instance (e.g., Personal, Business, Household, Joint).

Global Profile Scoping: All transactions, auto-categorization rules, fixed cost designations, and budget goals are strictly scoped to the active profile ID.

Profile Switcher UI: Quick-access pill in the Dashboard header with custom avatar colors.

Keyboard-Aware Creation: Add new profiles with custom theme colors via a smooth, non-blocking bottom sheet.

📊 Dynamic Dashboard Overview
An executive view of your financial state for any selected month.

Month Stepper Navigation: Fast forward and backward navigation between months with a custom bottom-sheet selector.

Proactive Awaiting Month Projection: Automatically projects and exposes the current calendar month even before statement files are uploaded.

Smart Coverage & Partial Month Detection: Scans transaction date ranges (MIN(date) to MAX(date)) and displays real-time status indicators:

🟡 In Progress: For current calendar months mid-cycle.

🟠 Partial Statement: Highlights historical months uploaded with partial or incomplete date coverage.

🟢 Full Statement: Complete month coverage detected.

Summary Hero Cards: Live totals for Income, Expenses, and Net Cash Flow.

Interactive Spending Allocation Chart: Visual bar chart displaying top category allocations with touch-to-filter capabilities.

Inline Category Breakdown: Drill down into specific spending categories with expandable sub-transaction lists.

📂 Statement Import & Data Parsing
Effortlessly convert raw banking statements into structured transaction records.

Multi-Format Parsing: Supports both CSV (.csv) and Excel (.xlsx, .xls) file formats.

Automatic Column Detection: Reads dates, amounts, raw descriptions, and merchants.

Concurrency Protection: Guard locks prevent double-selection and file reader freezes.

Profile Alignment: Automatically tags newly imported rows with the active profile ID.

🔄 Fixed vs. Flexible Cost Split
Differentiate between non-negotiable fixed bills and variable flexible spending.

Smart Pattern Detection: Scans multi-month transaction histories to auto-detect recurring merchants and subscription patterns.

Default Keyword Library: Pre-configured recognition for international and local utilities and services.

One-Tap Switcher: Easily mark or unmark any merchant as a recurring fixed cost directly from the transaction detail modal.

Visual Breakdown Bar: Interactive split track displaying exact proportions (%) and totals (€) for Fixed vs. Flexible costs.

🎯 Budget Goals & Progress Tracking
Stay on top of spending limits per category.

Monthly Limit Definition: Set monthly budget caps for individual spending categories.

Real-time Progress Bars: Visual indicators showing spent vs. limit with auto-calculated percentage bars.

Over-Budget Warnings: Visual cues when spending approaches or exceeds designated caps.

🔍 Advanced Transaction Search & Filtering
Locate specific purchases instantly.

Multi-Property Search: Query across merchant names, category names, or full raw bank descriptions.

Ranked Modals: Dedicated filter sheets for viewing ranked Income, Expense, Fixed, or Flexible lists.

Selectable Transaction Detail: Inspect exact transaction details, dates, and copyable raw statement descriptions.

🔔 Notifications & Reminders
Statement Reminders: Scheduled push notifications reminding users to import their monthly statements.

Auto-Cancellation: Importing a new statement automatically cancels pending reminders for that billing cycle.

Tech Architecture
Framework: React Native (Expo)

Language: TypeScript

Database: expo-sqlite (WAL Mode enabled)

Charts: react-native-gifted-charts

File Picker: expo-document-picker & expo-file-system

State Management: React Context (ProfileContext)