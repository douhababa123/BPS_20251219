# BPS 能力与排程平台 | BPS Capacity & Scheduling Platform

A production-ready React application for managing team capacity planning, competency assessments, and intelligent task allocation using Bosch industrial design principles.

## Features

### 🎯 Dashboard / 总览
- Real-time KPI tracking (saturation, gaps, pending tasks)
- Team competency radar charts (Current vs Target)
- Gap analysis visualization
- Task distribution analytics
- Recent activity timeline

### 📅 Calendar / 日历与饱和度
- AM/PM half-day granularity scheduling
- Multi-user calendar view (Month/Week toggle)
- Saturation monitoring with color-coded indicators
- Conflict detection for overlapping assignments
- Task filtering by type, location, and topic
- CSV export functionality

### 🎯 Matching / 智能任务分配
- Intelligent candidate ranking algorithm
- Skill score calculation (60% weight)
- Time availability scoring (40% weight)
- Role threshold validation (Lead/Expert gates)
- Detailed explanation drawer for match scoring
- Suggested user override capability
- One-click task assignment

### 🏆 Competency / 能力画像
- **Team View**: 9-module radar chart, gap ≥2 analysis grouped by owner
- **Person View**: 39-item individual radar, training recommendations
- Filter by unmet targets, gap ≥2, or key items only
- CSV export for team gap analysis

### 📥 Import Center / 数据导入
- 4-step wizard: Upload → Parse → Errors → Confirm
- Template download with field specifications
- Error validation and downloadable error reports
- Preview statistics before import

## Tech Stack

- **React 18** with TypeScript
- **Vite** for blazing-fast development
- **TailwindCSS** for utility-first styling
- **TanStack React Query** for server state management
- **Recharts** for data visualization
- **React Hook Form** + **Zod** for form validation
- **Lucide React** for icons

## Design System

### Colors
- Primary Blue: `#1E3A8A`
- Accent Red: `#B91C1C`
- Success Green: `#15803D`
- Warning Amber: `#B45309`
- Info Slate: `#334155`

### Topic Colors
- TPM: `#FACC15` (Yellow)
- Lean flow: `#EF4444` (Red)
- S-CIP & PGL: `#22C55E` (Green)
- Lean admin: `#3B82F6` (Blue)
- Failure prevention: `#8B5CF6` (Purple)
- Other: `#111827` (Dark Gray)

### Typography
- Font: Inter or system sans-serif
- Chinese text primary, English subtitles
- Light mode only with accessible focus states

## Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run typecheck

# Lint code
npm run lint
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx
│   ├── Sidebar.tsx
│   └── KpiCard.tsx
├── contexts/           # React contexts (Persona)
├── lib/               # Utilities and constants
│   ├── constants.ts   # Fixed dictionaries & thresholds
│   ├── types.ts       # TypeScript interfaces
│   ├── mockData.ts    # Seed data
│   ├── mockApi.ts     # Mock API endpoints
│   └── utils.ts       # Helper functions
├── pages/             # Main page components
│   ├── Dashboard.tsx
│   ├── Calendar.tsx
│   ├── Matching.tsx
│   ├── Competency.tsx
│   └── Import.tsx
└── App.tsx            # Root component
```

## Data Model

### Fixed Dictionaries
- **Task Types**: WS, SW, P, T, C, M, L, SD
- **Locations**: FLCNa, FLCCh, FCGNa, FCLCh, FDCCh, GPU-SU, EA, HA
- **Topics**: TPM, Lean flow, S-CIP & PGL, Lean admin, Failure prev., Other
- **Roles**: Lead, Expert, Member, Coach

### Role Thresholds
- **Lead**: Key item ≥4.0 AND module mean ≥3.5
- **Expert**: Key item ≥4.5 AND module mean ≥4.0

### Time Granularity
- **AM**: 3.5 hours
- **PM**: 4.5 hours

## Matching Algorithm

The intelligent matching algorithm ranks candidates based on:

1. **Skill Score (60%)**:
   - For each required competency item:
     - `base = min(Ci/Ri, 1)` where Ci=current level, Ri=required level
     - `bonus = 0.1` if Ti (target) > Ci
     - `w = 2` for key items, `1` for non-key items
     - `si = (base + bonus) × w`
   - Final skill score: `Σ(si) / Σ(w)`

2. **Time Score (40%)**:
   - `timeScore = freeSlots / totalSlots` during task period

3. **Final Score**: `skillScore × 0.6 + timeScore × 0.4`

4. **Role Gate Validation**: Ensures Lead/Expert candidates meet threshold requirements

## Mock Data

The application includes comprehensive seed data:
- **10 users** across different departments and roles
- **9 competency modules** with 39 total items
- **Assessment records** for 2025 with current/target levels
- **Calendar slots** for January 2025 with various task types

## Features Not Implemented

This is a frontend-only demo with mock APIs. In production, you would need:
- Real backend API integration
- Authentication & authorization
- Database persistence
- Real-time updates via WebSocket
- Advanced conflict resolution
- Notification system
- Historical data tracking

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Proprietary - Bosch Internal Use Only

---

**Note**: All data in this application is mocked for demonstration purposes. The matching algorithm, role thresholds, and business rules are fully functional but operate on simulated data.
