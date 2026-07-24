import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Encapsula el SDK de Stripe. Si no hay STRIPE_SECRET_KEY configurada, el
 * servicio queda deshabilitado (mismo patrón que Firebase/Mail): las operaciones
 * lanzan un error claro en tiempo de uso en vez de romper el arranque.
 */
@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const key = this.configService.get<string>('stripe.secretKey');
    if (!key) {
      this.logger.warn(
        'Stripe no configurado: los pagos con tarjeta no estarán disponibles',
      );
      return;
    }
    this.stripe = new Stripe(key);
    this.logger.log('Stripe inicializado');
  }

  isEnabled(): boolean {
    return this.stripe !== null;
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe no está configurado en el servidor');
    }
    return this.stripe;
  }

  /**
   * Crea un PaymentIntent por un monto. Stripe trabaja en la unidad mínima de la
   * moneda (céntimos): un precio de 12.50 se envía como 1250.
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>,
  ): Promise<Stripe.PaymentIntent> {
    return this.client().paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      metadata,
      automatic_payment_methods: { enabled: true },
    });
  }

  /**
   * Reembolsa un PaymentIntent (total).
   */
  async refund(paymentIntentId: string): Promise<Stripe.Refund> {
    return this.client().refunds.create({
      payment_intent: paymentIntentId,
    });
  }

  /**
   * Verifica la firma de un webhook y devuelve el evento. Lanza si la firma no
   * es válida (protege contra webhooks falsos).
   */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.configService.get<string>('stripe.webhookSecret');
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET no está configurado');
    }
    return this.client().webhooks.constructEvent(payload, signature, secret);
  }
}
