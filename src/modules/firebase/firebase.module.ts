import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

/**
 * Módulo global: expone FirebaseService para el envío de push (usado por
 * notifications). Global para no re-importarlo en cada módulo.
 */
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
