---
description: Preview server start, stop, and status check. Local development server management.
---

# /preview - Preview Management

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `devops-engineer`** | Skills: `clean-code, deployment-procedures, server-management, powershell-windows +1 more`
```

## Task

Manage preview server: start, stop, status check.

### Commands

```
/preview           - Show current status
/preview start     - Start server
/preview stop      - Stop server
/preview restart   - Restart
/preview check     - Health check
```

---

## Usage Examples

### Start Server
```
/preview start

Response:
🚀 Starting preview...
   Port: 3000
   Type: Next.js

✅ Preview ready!
   URL: http://localhost:3000
```

### Status Check
```
/preview

Response:
=== Preview Status ===

🌐 URL: http://localhost:3000
📁 Project: C:/projects/my-app
🏷️ Type: nextjs
💚 Health: OK
```

### Port Conflict
```
/preview start

Response:
⚠️ Port 3000 is in use.

Options:
1. Start on port 3001
2. Close app on 3000
3. Specify different port

Which one? (default: 1)
```

---

## Technical

Auto preview uses `auto_preview.py` script:

```bash
python3 .windsurf/scripts/auto_preview.py start [port]
python3 .windsurf/scripts/auto_preview.py stop
python3 .windsurf/scripts/auto_preview.py status
```

