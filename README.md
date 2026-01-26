# NeoRail

**Multimodal Operational Memory for Rail Networks**

NeoRail is a real-time decision support system for rail networks, serving as a smart operational memory, using Retrieval-Augmented Generation (RAG) to quickly access past solutions, avoiding slow calculations and high-stress human guesswork during disruptions.

This platform bridges the gap between field conductors and central control admins, ensuring that every operational decision is backed by the best historical data available.

---

## Key Capabilities

### Multimodal Ingestion (Conductor Portal)
*   **Voice-Native Reporting:** Hands-free incident logging using the Web Speech API to capture high-fidelity context from the field.
*   **Visual Evidence:** Image capture integration to provide ground-truth visual data of obstacles or infrastructure failure.
*   **Auto-Contextualization:** Automatic tagging of train ID, location, and timestamp to reduce manual data entry.

### Operational Intelligence (Admin Portal)
*   **Golden Run Retrieval:** (Architecture) Utilization of Qdrant vector search to find historical incidents with >90% similarity to the current event.
*   **Decision Support Dashboard:** A command center interface for reviewing field reports and selecting AI-validated resolution protocols.
*   **Feedback Loop:** Capability to store new successful resolutions back into the database, allowing the system to learn over time.

---

## Technical Architecture

### Frontend Layer
*   **Next.js:** App Router and Server Components for performance.
*   **TypeScript:** Strict type safety across the full stack.
*   **Tailwind CSS:** Responsive, utility-first styling for mission-critical UI.

### Backend & Data Layer
*   **Server Actions:** Direct backend logic execution without separate API controllers.
*   **Prisma ORM:** Type-safe database access and schema management.
*   **Supabase (PostgreSQL):** Relational storage for user data, active reports, and logs.
*   **NextAuth.js:** Secure authentication with role-based access control (RBAC).

### Simulation & Visualization
- **FastAPI** - Python backend for train network simulation
- **NumPy** - Mathematical computations for track geometry
- **TrainsSim Service** - Real-time train position tracking and incident simulation

### AI & Retrieval Layer
*   **Web Speech API:** Browser-native speech-to-text processing.
*   **Qdrant:** (Integration Phase) Vector database for storing and retrieving semantic embeddings of incident reports.

---

## Current project structure

```text
neorail/
├── web/
│   ├── app/                  # Next.js App Router (Routes & Pages)
│   │   ├── (auth)/           # Authentication flows
│   │   ├── admin/            # Admin dashboard & logic
│   │   ├── conductor/        # Conductor reporting interface
│   │   └── api/              # Backend API endpoints
│   ├── actions/              # Server Actions (Mutations)
│   ├── components/           # Reusable React UI components
│   ├── hooks/                # Custom React hooks (Speech, State)
│   ├── lib/                  # Utilities (Auth, Database, Helpers)
│   ├── prisma/               # Database Schema & Migrations
│   └── public/               # Static assets
├── TrainsSim/                   # Train Simulation Service
│   └── TrainsSim.py             # FastAPI backend for real-time train tracking
```

---

## Setup & Installation

### Prerequisites
*   Node.js 20+ (LTS)
*   PostgreSQL Database (Local or Supabase)
*   Git

### 1. Clone the Repository
```bash
git clone https://github.com/zonivisuals/neorail.git
cd neorail/web
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database Connection
DATABASE_URL="postgresql://user:password@host:5432/postgres?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/postgres"

# Authentication Security
AUTH_SECRET="your-generated-secret-key"
```

### 4. Database Initialization
```bash
# Generate Prisma Client
npx prisma generate

# Push Schema to Database
npx prisma db push
```

### 5. Account Setup
```bash
# Run the user creation script to seed a Conductor
npm run create-user
```

### 6. Start Application
```bash
npm run dev
```

### 7. Train Simulation Service (Optional)

The TrainsSim service provides real-time train position tracking and incident simulation for visualization purposes.

#### Setup Python Environment

```bash
# Navigate to TrainsSim directory
cd ../TrainsSim

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install fastapi uvicorn numpy
```

####  Run Simulation Server

```bash
uvicorn TrainsSim:app --reload
```

The API will be available at [http://localhost:8000](http://localhost:8000)


---

## Operational Workflow

### 1. The Field Trigger (Conductor)
*   **Login:** Conductor authenticates.
*   **Report:** Encountering an anomaly (e.g., "Tree on Track"), the conductor uses the Voice Input to describe the issue and uploads the scene photo.
*   **Submit:** The report is transmitted to the central server with "Open" status.

### 2. The Resolution (Admin)
*   **Alert:** Admin dashboard updates in real-time with the new incident.
*   **Analysis:** (Planned) The system vectorizes the input and queries Qdrant for similar past cases.
*   **Action:** Admin reviews the AI-suggested "Golden Run" or drafts a manual solution.
*   **Broadcast:** The resolution orders are sent back to the specific conductor and relevant network nodes.

---

## Browser Support Notes

**Voice Recognition Features:**
*   **Supported:** Google Chrome, Microsoft Edge.
*   **Limited/Unsupported:** Firefox, Safari (Due to Web Speech API constraints), Brave.

*an active internet connection is required for voice processing.*

---

## Security

*   **Authentication:** NextAuth v5 handling session management.
*   **Data Protection:** Password hashing via bcryptjs.
*   **Access Control:** Middleware-protected routes ensuring separation of Conductor and Admin privileges.

---

## Implementation Status & Roadmap

**Implemented:**
*   Auth & Role Management.
*   Conductor Reporting Interface (Voice + Image).
*   Dashboard UI.
*   PostgreSQL Relational Storage.

**In Progress:**
*   Qdrant Vector Database connection with the current setup.


---

## Team
- **Developer**: Mohamed ([github](https://github.com/zonivisuals))
- **Developer**: Mahdi ([github](https://github.com/MahdiGuem))