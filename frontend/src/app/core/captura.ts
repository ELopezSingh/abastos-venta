import { environment } from '../../environments/environment';

/**
 * true en el APK (la tablet captura) y false en la web (solo consulta).
 * Se fija al compilar con los environments; no cambia en tiempo de ejecución.
 */
export const CAPTURA_HABILITADA = environment.capturaHabilitada;

/** Pantalla de inicio: Vender en la tablet, Inicio en la web. */
export const RUTA_INICIO = CAPTURA_HABILITADA ? 'vender' : 'inicio';
