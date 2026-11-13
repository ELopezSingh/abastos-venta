import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { EstadoServidorService } from './estado-servidor.service';
import { MAX_REINTENTOS_503, reintento503Interceptor } from './reintento-503.interceptor';

const DESPERTANDO = { mensaje: 'El servidor está despertando. Intenta de nuevo en unos segundos.' };
const opciones503 = {
  status: 503,
  statusText: 'Service Unavailable',
  headers: { 'Retry-After': '5' },
};

describe('reintento503Interceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let servidor: EstadoServidorService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([reintento503Interceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    servidor = TestBed.inject(EstadoServidorService);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('reintenta una consulta después del 503 y avisa mientras espera', async () => {
    const respuesta = firstValueFrom(http.get('/api/trailers'));

    backend.expectOne('/api/trailers').flush(DESPERTANDO, opciones503);
    expect(servidor.despertando()).toBe(true);

    await vi.advanceTimersByTimeAsync(5_000);
    backend.expectOne('/api/trailers').flush([{ id: 'a' }]);

    expect(await respuesta).toEqual([{ id: 'a' }]);
    expect(servidor.despertando()).toBe(false);
  });

  it(`se rinde después de ${MAX_REINTENTOS_503} reintentos y entrega el 503`, async () => {
    const respuesta = firstValueFrom(http.get('/api/resumen/dia')).catch((e: unknown) => e);

    for (let i = 0; i <= MAX_REINTENTOS_503; i++) {
      backend.expectOne('/api/resumen/dia').flush(DESPERTANDO, opciones503);
      await vi.advanceTimersByTimeAsync(5_000);
    }

    const error = (await respuesta) as HttpErrorResponse;
    expect(error.status).toBe(503);
    expect(error.error).toEqual(DESPERTANDO);
    expect(servidor.despertando()).toBe(false);
  });

  it('reintenta el login', async () => {
    const respuesta = firstValueFrom(http.post('/api/auth/login', {}));
    backend.expectOne('/api/auth/login').flush(DESPERTANDO, opciones503);
    await vi.advanceTimersByTimeAsync(5_000);
    backend.expectOne('/api/auth/login').flush({ usuario: 'tio' });
    expect(await respuesta).toEqual({ usuario: 'tio' });
  });

  it('no reintenta lo que guarda (podría duplicar un vale)', async () => {
    const respuesta = firstValueFrom(http.post('/api/tickets', {})).catch((e: unknown) => e);
    backend.expectOne('/api/tickets').flush(DESPERTANDO, opciones503);
    expect(((await respuesta) as HttpErrorResponse).status).toBe(503);
    expect(servidor.despertando()).toBe(false);
  });

  it('no reintenta otros errores', async () => {
    const respuesta = firstValueFrom(http.get('/api/trailers')).catch((e: unknown) => e);
    backend
      .expectOne('/api/trailers')
      .flush({ mensaje: 'x' }, { status: 500, statusText: 'Error' });
    expect(((await respuesta) as HttpErrorResponse).status).toBe(500);
  });

  it('funciona con la URL completa del APK', async () => {
    const url = 'https://abastos-venta-production.up.railway.app/api/trailers';
    const respuesta = firstValueFrom(http.get(url));
    backend.expectOne(url).flush(DESPERTANDO, opciones503);
    await vi.advanceTimersByTimeAsync(5_000);
    backend.expectOne(url).flush([]);
    expect(await respuesta).toEqual([]);
  });
});
