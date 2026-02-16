# HRMS - Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+
- MySQL 8.0+ (running)
- npm

### 2. Database Setup

Create the MySQL database:
```sql
CREATE DATABASE hrms_db;
```

### 3. Environment Configuration

Update the `.env` file in the server directory with your MySQL credentials:
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3306/hrms_db"
JWT_SECRET="your-super-secret-jwt-key-change-this"
JWT_EXPIRES_IN="7d"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 4. Install Dependencies & Setup Database

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run db:seed
```

Or run all at once:
```bash
npm run setup
```

### 5. Start the Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@hrms.com | admin123 |
| HR | hr@hrms.com | admin123 |
| Employee | employee@hrms.com | admin123 |

## Electron Desktop App

```bash
cd electron
npm install
npm start
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed database with sample data |
| `npm run db:studio` | Open Prisma Studio GUI |
| `npm run db:reset` | Reset database |
| `npm run setup` | Full database setup |

## API Documentation

See the main README.md for complete API endpoints documentation.
