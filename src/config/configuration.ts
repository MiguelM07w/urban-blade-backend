export interface AppConfig {
  port: number;
  nodeEnv: string;
  apiPrefix: string;
  mongodbUri: string;
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  google: {
    clientId: string;
  };
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
  firebase: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  };
  mail: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
    resetUrlBase: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
    webhookSecretOrders: string;
    currency: string;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: process.env.API_PREFIX ?? 'api',
  mongodbUri: process.env.MONGODB_URI ?? '',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? '',
    // La clave privada suele venir con \n escapados en el .env.
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  },
  mail: {
    host: process.env.SMTP_HOST ?? '',
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    // true para puerto 465 (SSL); false para 587 (STARTTLS).
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    // Remitente mostrado. Si se omite, se usa el usuario SMTP.
    from: process.env.MAIL_FROM ?? '',
    // Base para armar el enlace de reseteo que abre el móvil/web.
    resetUrlBase: process.env.RESET_URL_BASE ?? '',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    // Secreto adicional para el webhook de compras de productos (orders), que en
    // Stripe es un endpoint aparte con su propio signing secret. Opcional: si no
    // se define, se usa el mismo STRIPE_WEBHOOK_SECRET para ambos.
    webhookSecretOrders: process.env.STRIPE_WEBHOOK_SECRET_ORDERS ?? '',
    // Moneda ISO para los cobros (crc = colón costarricense, usd, etc.).
    currency: process.env.STRIPE_CURRENCY ?? 'usd',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
