# Security setup

The Cloud Functions use Firebase Secret Manager for sensitive values. Do not commit real secrets to the repository.

Required secrets:

```powershell
npx.cmd firebase-tools functions:secrets:set AGORA_APP_CERTIFICATE
npx.cmd firebase-tools functions:secrets:set TELEGRAM_BOT_TOKEN
npx.cmd firebase-tools functions:secrets:set BROADCAST_ADMIN_KEY
```

Non-secret runtime params can be set in `functions/.env` for local development or deploys. Use `functions/.env.example` as the template.

Important: the old Telegram bot token and Agora certificate were previously present in source code. Rotate those credentials before deploying the functions update.
