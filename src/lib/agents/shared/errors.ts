export class AgentError extends Error {
  readonly code: "sem-fonte" | "sem-dados" | "nao-autorizado" | "pedido-invalido" | "limite";

  constructor(message: string, code: "sem-fonte" | "sem-dados" | "nao-autorizado" | "pedido-invalido" | "limite") {
    super(message);
    this.name = "AgentError";
    this.code = code;
  }
}
