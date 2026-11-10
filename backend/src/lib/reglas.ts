import { esErrorDeRegla, type TipoErrorRegla } from "@abastos/shared";
import { AppError } from "../middlewares/error-handler.js";

const ESTADO_HTTP: Record<TipoErrorRegla, number> = {
  NO_ENCONTRADO: 404,
  CONFLICTO: 409,
  INVALIDO: 400,
};

/** Ejecuta una regla de @abastos/shared y traduce su error a AppError. */
export function conReglas<T>(regla: () => T): T {
  try {
    return regla();
  } catch (error) {
    if (esErrorDeRegla(error)) {
      throw new AppError(ESTADO_HTTP[error.tipo], error.message);
    }
    throw error;
  }
}
