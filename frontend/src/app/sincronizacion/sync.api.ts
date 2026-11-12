import { httpResource } from '@angular/common/http';
import { Injectable } from '@angular/core';
import type { EstadoSyncDto, OperacionesRechazadasDto } from '@abastos/shared';

const URL = '/api/sync';

@Injectable({ providedIn: 'root' })
export class SyncApi {
  /** Último contacto de la tablet y número de rechazos. */
  estado(activo: () => boolean) {
    return httpResource<EstadoSyncDto>(() => (activo() ? `${URL}/estado` : undefined));
  }

  /** Operaciones rechazadas, la más reciente primero. */
  rechazadas() {
    return httpResource<OperacionesRechazadasDto>(() => `${URL}/rechazadas`);
  }
}
