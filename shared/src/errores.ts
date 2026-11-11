/**
 * Error de regla de negocio. Lo lanzan las funciones de reglas/ y lo traduce
 * cada lado: el backend a un código HTTP y la tablet a un mensaje (o a una
 * operación rechazada).
 */
export type TipoErrorRegla = "NO_ENCONTRADO" | "CONFLICTO" | "INVALIDO";

export class ErrorDeRegla extends Error {
  readonly tipo: TipoErrorRegla;

  constructor(tipo: TipoErrorRegla, mensaje: string) {
    super(mensaje);
    this.name = "ErrorDeRegla";
    this.tipo = tipo;
  }
}

/** También reconoce el error si viene de otra copia del paquete. */
export function esErrorDeRegla(error: unknown): error is ErrorDeRegla {
  return (
    error instanceof ErrorDeRegla ||
    (error instanceof Error && error.name === "ErrorDeRegla" && "tipo" in error)
  );
}
