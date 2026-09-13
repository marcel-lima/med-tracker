# Remédios

Web app (PWA) para acompanhar o tratamento de um pet: remédios, horários, ração e lembretes no celular.

- Tratamento editável no app: nome, dose, frequência, duração, data de início.
- Ração como parte do tratamento: remédios "antes", "junto" ou "depois" de comer, com horário calculado.
- Relógio de cápsulas na tela inicial mostrando a próxima dose.
- Lembretes por push no horário exato de cada dose, mesmo com o app fechado.

## Como roda

- Front-end: React + Vite, instalado como app na tela de início (PWA).
- Servidor: funções na Vercel (`api/`).
- Dados: Upstash Redis (tratamento, doses marcadas, inscrição do push).
- Lembretes: Upstash QStash agenda uma mensagem por dose e chama `api/send-push` na hora.

## Publicação

Cada push na `main` publica na Vercel pelo GitHub Action `.github/workflows/deploy.yml`. Ele precisa do segredo `VERCEL_TOKEN` no repositório.

## Variáveis de ambiente (Vercel)

| Variável | Para quê |
| --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Assinatura do web push |
| `VITE_VAPID_PUBLIC_KEY` | A mesma chave pública, exposta ao app |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | QStash (criadas pela integração Upstash na Vercel) |
| `APP_URL` | Opcional. URL pública, se não for a padrão da Vercel |

## Desenvolvimento

```
npm install
npm run dev
```

Sem servidor local as rotas `/api` respondem 404 e o app segue funcionando só com os dados do navegador.
