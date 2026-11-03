import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsMx from '@angular/common/locales/es-MX';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  provideAppInitializer,
  inject,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { ActualizacionesService } from './core/pwa/actualizaciones.service';
import { sinConexionInterceptor } from './core/pwa/sin-conexion.interceptor';
import { PrecargaService } from './core/pwa/precarga.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';
import { apiBaseUrlInterceptor } from './core/api-base-url.interceptor';
import { Capacitor } from '@capacitor/core';

registerLocaleData(localeEsMx);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([apiBaseUrlInterceptor, sinConexionInterceptor, authInterceptor]),
    ),
    { provide: LOCALE_ID, useValue: 'es-MX' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'MXN' },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode() && !Capacitor.isNativePlatform(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideAppInitializer(() => inject(ActualizacionesService).iniciar()),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      const precarga = inject(PrecargaService);
      await auth.verificarSesion();
      if (auth.autenticado()) void precarga.iniciar();
    }),
  ],
};
